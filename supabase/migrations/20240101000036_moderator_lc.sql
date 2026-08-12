-- Migration: 20240101000036_moderator_lc
-- Phase G10 — Moderator-gated Legit Check + community moderator roles.
--
-- Founder decisions (2026-08-12):
--   1. General comments are FULLY removed (thread, seller toggle, comments_enabled).
--   2. Legit Check is moderators-only: is_moderator OR role='admin' (verified_checker /
--      tier='gold' no longer grant LC posting). LC stays publicly readable.
--   3. Auto-promotion: 3 distinct CURRENT (non-banned) moderators recommending one
--      id-verified member promotes them immediately.
--   4. Forward hook for the future auto-authentication bot: comments.source + a
--      service_role-only post_auto_lc() seam (the bot itself is NOT built here).
--
-- No runtime feature flag: this is a deliberate replacement, enforced in-DB. The branch
-- + gates are the safety; this migration is the atomic switch. Trusted checkers are
-- seeded as the first moderators (bottom of file) so LC has eligible posters at cutover.
--
-- Grant discipline: is_moderator / moderator_since are NEVER granted UPDATE to
-- `authenticated` (self-promotion escalation guard). They are set only via service_role
-- (admin route) or the SECURITY DEFINER recommend_moderator() RPC.
--
-- db-guard: additive columns are IF NOT EXISTS; the destructive parts (delete general
-- rows, drop comments_enabled, drop toggle_listing_comments) are intentional and safe
-- pre-launch (no production data). RLS enabled on the new table in this same migration.

-- ─── 1. profiles: moderator flag ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_moderator    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderator_since TIMESTAMPTZ;

-- Partial index for "is this author a mod" / "list moderators" lookups.
CREATE INDEX IF NOT EXISTS profiles_is_moderator_idx ON profiles (id)
  WHERE is_moderator = true;

-- NOTE: no UPDATE grant on is_moderator/moderator_since to authenticated (escalation
-- guard). Set exclusively via service_role or recommend_moderator() (SECURITY DEFINER).

-- ─── 2. moderator_recommendations: nomination ledger ────────────────────────────
CREATE TABLE IF NOT EXISTS moderator_recommendations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: nominee account deleted -> drop their pending recommendations.
  nominee_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- CASCADE: recommender account deleted -> drop the recs they authored.
  recommender_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one recommendation per moderator per nominee (dedup / idempotent vouch).
  UNIQUE (nominee_id, recommender_id),
  -- a moderator can never recommend themselves.
  CHECK (nominee_id <> recommender_id)
);

CREATE INDEX IF NOT EXISTS moderator_recs_nominee_idx
  ON moderator_recommendations (nominee_id);
CREATE INDEX IF NOT EXISTS moderator_recs_recommender_idx
  ON moderator_recommendations (recommender_id);

ALTER TABLE moderator_recommendations ENABLE ROW LEVEL SECURITY;

-- Admin: read all.
CREATE POLICY "modrec_admin_select"
  ON moderator_recommendations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Recommender: read the recommendations they authored.
CREATE POLICY "modrec_recommender_select"
  ON moderator_recommendations FOR SELECT
  TO authenticated
  USING (recommender_id = auth.uid());

-- Nominee: read the recommendations about themselves.
CREATE POLICY "modrec_nominee_select"
  ON moderator_recommendations FOR SELECT
  TO authenticated
  USING (nominee_id = auth.uid());

-- No client INSERT/UPDATE/DELETE policy — writes go only through recommend_moderator().
GRANT SELECT ON moderator_recommendations TO authenticated;

-- ─── 3. comments: source + nullable author (auto-auth bot seam) ─────────────────
CREATE TYPE comment_source AS ENUM ('human', 'auto');

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS source  comment_source NOT NULL DEFAULT 'human',
  -- Optional forward-facing verdict slot the auto system will populate.
  ADD COLUMN IF NOT EXISTS verdict TEXT
    CHECK (verdict IS NULL OR verdict IN ('authentic', 'counterfeit', 'uncertain'));

-- A system-authored LC verdict has no human author.
ALTER TABLE comments ALTER COLUMN author_id DROP NOT NULL;

-- Integrity: human comments require an author; auto comments must not have one.
ALTER TABLE comments ADD CONSTRAINT comments_author_source_ck CHECK (
  (source = 'human' AND author_id IS NOT NULL) OR
  (source = 'auto'  AND author_id IS NULL)
);

-- ─── 4. Remove general comments ─────────────────────────────────────────────────
-- Delete general-thread rows (comment_actions cascade off the comments FK).
DELETE FROM comments WHERE thread_type = 'general';
-- Drop the seller toggle RPC + the column it toggled.
DROP FUNCTION IF EXISTS toggle_listing_comments(UUID, BOOLEAN);
ALTER TABLE listings DROP COLUMN IF EXISTS comments_enabled;
-- NOTE: the thread_type enum keeps its 'general' value (Postgres can't drop an enum
-- value cleanly). It is now dead — every row is 'lc' and post_comment() rejects 'general'.

-- ─── 5. post_comment(): LC gate = moderator/admin, general rejected ─────────────
CREATE OR REPLACE FUNCTION post_comment(
  p_listing_id  UUID,
  p_thread_type thread_type,
  p_body        TEXT,
  p_redacted    BOOLEAN DEFAULT false,
  p_parent_id   UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile profiles%ROWTYPE;
  v_listing listings%ROWTYPE;
  v_new_id  UUID;
BEGIN
  -- Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- General comments are removed platform-wide.
  IF p_thread_type <> 'lc' THEN
    RAISE EXCEPTION 'general_comments_removed' USING ERRCODE = 'P0001';
  END IF;

  -- Load profile
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- ID verification (admin bypass retained for alpha testing)
  IF v_profile.id_verification_status <> 'verified' AND v_profile.role <> 'admin' THEN
    RAISE EXCEPTION 'id_verification_required' USING ERRCODE = 'P0001';
  END IF;

  -- Load listing (must be active)
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found_or_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- LC permission: moderators (or admins) only. Vetted posters, so no rate limit.
  IF NOT (v_profile.is_moderator OR v_profile.role = 'admin') THEN
    RAISE EXCEPTION 'lc_permission_denied' USING ERRCODE = 'P0001';
  END IF;

  -- Validate parent_id (one-level replies only, same thread + listing)
  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_parent_id
        AND listing_id = p_listing_id
        AND thread_type = p_thread_type
    ) THEN
      RAISE EXCEPTION 'parent_comment_not_found' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO comments (listing_id, author_id, parent_id, thread_type, body, redacted, source)
  VALUES (p_listing_id, v_user_id, p_parent_id, p_thread_type, p_body, p_redacted, 'human')
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION post_comment(UUID, thread_type, TEXT, BOOLEAN, UUID) TO authenticated;

-- ─── 6. recommend_moderator(): vouch + auto-promote at 3 ────────────────────────
-- MODERATOR_PROMOTION_THRESHOLD = 3 distinct CURRENT (non-banned) moderators.
-- Returns jsonb { distinctCount, promoted, alreadyModerator }. The TS route dispatches
-- the moderator_granted notification when promoted = true (SQL cannot call notify()).
CREATE OR REPLACE FUNCTION recommend_moderator(p_nominee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  UUID;
  v_cprof   profiles%ROWTYPE;
  v_nominee profiles%ROWTYPE;
  v_count   INT;
  v_promoted BOOLEAN := false;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Caller must be a current, non-banned moderator (admins may also recommend).
  SELECT * INTO v_cprof FROM profiles WHERE id = v_caller;
  IF NOT FOUND OR v_cprof.banned THEN
    RAISE EXCEPTION 'not_a_moderator' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (v_cprof.is_moderator OR v_cprof.role = 'admin') THEN
    RAISE EXCEPTION 'not_a_moderator' USING ERRCODE = 'P0001';
  END IF;

  IF p_nominee_id = v_caller THEN
    RAISE EXCEPTION 'cannot_recommend_self' USING ERRCODE = 'P0001';
  END IF;

  -- Nominee must exist, be id-verified, and not banned.
  SELECT * INTO v_nominee FROM profiles WHERE id = p_nominee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nominee_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.banned THEN
    RAISE EXCEPTION 'nominee_banned' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.id_verification_status <> 'verified' THEN
    RAISE EXCEPTION 'nominee_not_verified' USING ERRCODE = 'P0001';
  END IF;

  -- Already a moderator -> no-op (record the vouch idempotently, report state).
  IF v_nominee.is_moderator THEN
    INSERT INTO moderator_recommendations (nominee_id, recommender_id)
    VALUES (p_nominee_id, v_caller)
    ON CONFLICT (nominee_id, recommender_id) DO NOTHING;
    RETURN jsonb_build_object('distinctCount', 0, 'promoted', false, 'alreadyModerator', true);
  END IF;

  -- Record this vouch (idempotent).
  INSERT INTO moderator_recommendations (nominee_id, recommender_id)
  VALUES (p_nominee_id, v_caller)
  ON CONFLICT (nominee_id, recommender_id) DO NOTHING;

  -- Count DISTINCT recommenders who are STILL valid moderators (non-banned).
  -- A revoked/banned moderator's past vouch stops counting automatically.
  SELECT COUNT(*) INTO v_count
  FROM moderator_recommendations r
  JOIN profiles p ON p.id = r.recommender_id
  WHERE r.nominee_id = p_nominee_id
    AND p.is_moderator = true
    AND p.banned = false;

  IF v_count >= 3 THEN
    UPDATE profiles
      SET is_moderator = true, moderator_since = now()
      WHERE id = p_nominee_id AND is_moderator = false;
    v_promoted := true;
  END IF;

  RETURN jsonb_build_object('distinctCount', v_count, 'promoted', v_promoted, 'alreadyModerator', false);
END;
$$;

GRANT EXECUTE ON FUNCTION recommend_moderator(UUID) TO authenticated;

-- ─── 7. post_auto_lc(): service_role-only seam for the future auto-auth bot ──────
-- The auto-authentication service (NOT built in this phase) calls this server-side with
-- the service key to drop a system-authored LC verdict. author_id is NULL; source='auto'.
CREATE OR REPLACE FUNCTION post_auto_lc(
  p_listing_id UUID,
  p_body       TEXT,
  p_pinned     BOOLEAN DEFAULT true,
  p_verdict    TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM listings WHERE id = p_listing_id AND status = 'active') THEN
    RAISE EXCEPTION 'listing_not_found_or_inactive' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO comments (listing_id, author_id, thread_type, body, source, pinned, verdict)
  VALUES (p_listing_id, NULL, 'lc', p_body, 'auto', p_pinned, p_verdict)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- service_role ONLY — never exposed to authenticated/anon.
GRANT EXECUTE ON FUNCTION post_auto_lc(UUID, TEXT, BOOLEAN, TEXT) TO service_role;

-- ─── 8. Bootstrap: seed trusted checkers as the first moderators ────────────────
-- One-time data migration so LC has eligible posters at cutover. Founder appoints any
-- further initial moderators via /api/admin/profiles/[id]/moderator.
UPDATE profiles
  SET is_moderator = true, moderator_since = now()
  WHERE verified_checker = true AND is_moderator = false;
