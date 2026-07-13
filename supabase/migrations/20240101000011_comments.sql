-- Migration: 20240101000011_comments
-- Community layer (B7): legit-check threads + general comments.
--
-- Changes:
--   profiles: add verified_checker boolean, checker_category text, tier enum
--   listings: add comments_enabled boolean
--   New tables: comments, comment_actions
--   New RPCs:
--     post_comment()               — SECURITY DEFINER, rate-limited, LC-gated
--     check_and_auto_flag_comment() — SECURITY DEFINER helper for >=2 flag auto-flag
--     toggle_listing_comments()    — SECURITY DEFINER seller toggle (works on active listings)
--
-- RLS:
--   comments: anyone reads visible on active listings; INSERT via RPC only;
--             admin UPDATE only (status/pin); no client INSERT/DELETE.
--   comment_actions: authenticated read (for agree-count display) + insert own row.
--
-- GRANT discipline:
--   verified_checker/checker_category/tier set admin-only via service_role routes —
--   NOT granted to authenticated (avoids self-promotion escalation).
--   comments_enabled toggled via toggle_listing_comments() RPC (bypasses active-listing
--   restriction in listings_seller_update policy).
--
-- db-guard review: APPROVED after fixes (see review notes in prompts/B7.md)

-- ─── 1. tier enum ──────────────────────────────────────────────────────────────
CREATE TYPE member_tier AS ENUM ('bronze', 'silver', 'gold');

-- ─── 2. Alter profiles ──────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verified_checker  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checker_category  TEXT,
  ADD COLUMN IF NOT EXISTS tier              member_tier NOT NULL DEFAULT 'bronze';

-- Index for admin checker lookups
CREATE INDEX IF NOT EXISTS profiles_verified_checker_idx ON profiles (verified_checker)
  WHERE verified_checker = true;

-- NOTE: No UPDATE grant for verified_checker/checker_category/tier to authenticated.
-- These are admin-controlled fields; set exclusively via service_role in admin API routes.

-- ─── 3. Alter listings ──────────────────────────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

-- NOTE: No direct UPDATE grant for comments_enabled to authenticated on active listings.
-- Use toggle_listing_comments() RPC instead (see below).

-- ─── 4. Enums for comments ──────────────────────────────────────────────────────
CREATE TYPE thread_type         AS ENUM ('lc', 'general');
CREATE TYPE comment_status      AS ENUM ('visible', 'removed', 'flagged');
CREATE TYPE comment_action_type AS ENUM ('agree', 'flag');

-- ─── 5. comments table ──────────────────────────────────────────────────────────
-- INSERT is restricted to post_comment() RPC — no direct client INSERT policy.
-- UPDATE (status, pinned) restricted to admin via RLS; no client DELETE.
CREATE TABLE comments (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: preserve comment history while listing exists
  listing_id  UUID           NOT NULL
                REFERENCES listings(id) ON DELETE RESTRICT,
  -- RESTRICT: block account deletion if user has comments
  author_id   UUID           NOT NULL
                REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Nullable: one level of reply; SET NULL if parent deleted
  parent_id   UUID
                REFERENCES comments(id) ON DELETE SET NULL,
  thread_type thread_type    NOT NULL,
  body        TEXT           NOT NULL,
  status      comment_status NOT NULL DEFAULT 'visible',
  redacted    BOOLEAN        NOT NULL DEFAULT false,
  pinned      BOOLEAN        NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX comments_listing_thread_idx  ON comments (listing_id, thread_type, created_at DESC);
CREATE INDEX comments_author_id_idx       ON comments (author_id);
CREATE INDEX comments_parent_id_idx       ON comments (parent_id);
-- For rate-limit query inside RPC
CREATE INDEX comments_author_created_idx  ON comments (author_id, created_at DESC);
-- For pinned card lookup
CREATE INDEX comments_pinned_idx          ON comments (listing_id, thread_type, pinned)
  WHERE pinned = true;
-- For flagged admin queue
CREATE INDEX comments_status_flagged_idx  ON comments (status, created_at DESC)
  WHERE status = 'flagged';

-- ─── 6. comment_actions table ───────────────────────────────────────────────────
-- Immutable audit log: no UPDATE/DELETE by any client.
-- flag-actor identity is visible to all authenticated users (transparency design decision;
-- acceptable as comments are public and agree/flag are non-sensitive signals).
CREATE TABLE comment_actions (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: comment removed → its actions removed
  comment_id  UUID                NOT NULL
                REFERENCES comments(id) ON DELETE CASCADE,
  -- RESTRICT: block account deletion if user has comment_actions
  actor_id    UUID                NOT NULL
                REFERENCES profiles(id) ON DELETE RESTRICT,
  action      comment_action_type NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  -- Deduplicate: one agree/flag per (comment, actor, action)
  UNIQUE (comment_id, actor_id, action)
);

CREATE INDEX comment_actions_comment_id_idx ON comment_actions (comment_id);
CREATE INDEX comment_actions_actor_id_idx   ON comment_actions (actor_id);
-- For flag-count threshold query
CREATE INDEX comment_actions_flag_idx       ON comment_actions (comment_id, action)
  WHERE action = 'flag';

-- ─── 7. RLS: comments ───────────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated: read visible comments on active listings
CREATE POLICY "comments_public_read_visible"
  ON comments FOR SELECT
  USING (
    status = 'visible'
    AND EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.status = 'active'
    )
  );

-- Admin: read ALL comments (including removed/flagged)
CREATE POLICY "comments_admin_select"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin: UPDATE status + pinned for moderation
CREATE POLICY "comments_admin_update"
  ON comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- No client INSERT policy — post_comment() RPC handles inserts.
-- No client DELETE policy — comments are immutable (moderation via status).

-- ─── 8. RLS: comment_actions ────────────────────────────────────────────────────
ALTER TABLE comment_actions ENABLE ROW LEVEL SECURITY;

-- Authenticated: read all actions (for agree-count display)
CREATE POLICY "comment_actions_auth_read"
  ON comment_actions FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated: insert own action
CREATE POLICY "comment_actions_auth_insert"
  ON comment_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- ─── 9. Grants ──────────────────────────────────────────────────────────────────
-- comments: anon + authenticated read (public tab); admin UPDATE via RLS
GRANT SELECT ON comments TO anon;
GRANT SELECT ON comments TO authenticated;
GRANT UPDATE (status, pinned) ON comments TO authenticated;  -- scoped to admin by RLS

-- comment_actions
GRANT SELECT, INSERT ON comment_actions TO authenticated;

-- profiles: admin-only columns (verified_checker, checker_category, tier) are NOT
-- granted to authenticated here. Admin routes use service_role (bypasses RLS).
-- No additional profile grants needed for B7.

-- listings: comments_enabled toggle is handled by the toggle_listing_comments() RPC.
-- The existing GRANT on listings (migration 000004) already covers INSERT/UPDATE/DELETE.

-- ─── 10. post_comment() RPC ─────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS for the INSERT.
-- All authorization checks are explicit inside the function.
-- Body redaction (filterMessage) is applied by the TS API layer before calling this RPC,
-- following the same pattern as send_message() in B6.
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
  v_user_id       UUID;
  v_profile       profiles%ROWTYPE;
  v_listing       listings%ROWTYPE;
  v_comment_count INT;
  v_new_id        UUID;
BEGIN
  -- ── Auth ──────────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- ── Load profile ──────────────────────────────────────────────────────────
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- ── ID verification (admin bypass for testing during alpha) ───────────────
  IF v_profile.id_verification_status != 'verified' AND v_profile.role != 'admin' THEN
    RAISE EXCEPTION 'id_verification_required' USING ERRCODE = 'P0001';
  END IF;

  -- ── Load listing (must be active) ────────────────────────────────────────
  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found_or_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- ── LC thread permission: verified_checker OR gold tier OR admin ──────────
  IF p_thread_type = 'lc'
     AND NOT (v_profile.verified_checker OR v_profile.tier = 'gold' OR v_profile.role = 'admin')
  THEN
    RAISE EXCEPTION 'lc_permission_denied' USING ERRCODE = 'P0001';
  END IF;

  -- ── General comments: seller may disable (LC is never disableable) ────────
  IF p_thread_type = 'general' AND NOT v_listing.comments_enabled THEN
    RAISE EXCEPTION 'comments_disabled' USING ERRCODE = 'P0001';
  END IF;

  -- ── Rate limit: accounts <30 days old → max 2 comments per 24h ───────────
  IF v_profile.role != 'admin'
     AND v_profile.created_at > now() - INTERVAL '30 days'
  THEN
    SELECT COUNT(*) INTO v_comment_count
    FROM comments
    WHERE author_id = v_user_id
      AND created_at >= now() - INTERVAL '24 hours';

    IF v_comment_count >= 2 THEN
      RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Validate parent_id (one-level replies only) ───────────────────────────
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

  -- ── Insert ────────────────────────────────────────────────────────────────
  INSERT INTO comments (listing_id, author_id, parent_id, thread_type, body, redacted)
  VALUES (p_listing_id, v_user_id, p_parent_id, p_thread_type, p_body, p_redacted)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION post_comment(UUID, thread_type, TEXT, BOOLEAN, UUID) TO authenticated;

-- ─── 11. check_and_auto_flag_comment() helper ───────────────────────────────────
-- Called from the API route after a flag action is inserted.
-- Transitions comment to 'flagged' when flag count >= 2.
-- SECURITY DEFINER: needs to write to comments (owner is postgres; authenticated cannot
-- UPDATE status except via admin policy). Called with service_role from API routes.
CREATE OR REPLACE FUNCTION check_and_auto_flag_comment(p_comment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag_count INT;
BEGIN
  SELECT COUNT(*) INTO v_flag_count
  FROM comment_actions
  WHERE comment_id = p_comment_id AND action = 'flag';

  IF v_flag_count >= 2 THEN
    UPDATE comments
    SET status = 'flagged'
    WHERE id = p_comment_id AND status = 'visible';
  END IF;
END;
$$;

-- Called via service_role in API routes (not exposed to client role)
GRANT EXECUTE ON FUNCTION check_and_auto_flag_comment(UUID) TO service_role;

-- ─── 12. toggle_listing_comments() seller RPC ────────────────────────────────────
-- Sellers can toggle comments_enabled on their own listings (including active ones).
-- The existing listings_seller_update policy blocks updates to active listings,
-- so we use SECURITY DEFINER to bypass that restriction for this specific field only.
CREATE OR REPLACE FUNCTION toggle_listing_comments(
  p_listing_id UUID,
  p_enabled    BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Only the listing's seller (or admin) may toggle
  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = p_listing_id
      AND (seller_id = v_user_id
           OR EXISTS (
             SELECT 1 FROM profiles p
             WHERE p.id = v_user_id AND p.role = 'admin'
           ))
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
  END IF;

  UPDATE listings SET comments_enabled = p_enabled WHERE id = p_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_listing_comments(UUID, BOOLEAN) TO authenticated;
