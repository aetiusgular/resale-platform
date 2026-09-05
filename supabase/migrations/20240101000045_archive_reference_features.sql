-- Migration: 20240101000045_archive_reference_features
-- Backend alignment with the approved ARCHIVE design review (Downloads/frontend):
--   1. listings: color, subcategory, flat measurements, view counter, drafts with
--      partial data, sold listings publicly readable (SHOW ONLY → Sold items).
--   2. comments: community Legit Check — any verified member can post + cast a
--      LEGIT / FLAG vote; moderators still sign verdicts (pinned). Comments stay
--      readable once a listing sells.
--   3. conversation_reads: per-participant read cursor → unread counts + header badge.
--   4. saved_searches: per-search ALERTS toggle + last_seen_at (the "n NEW" tag).
--   5. profiles: display_name, avatar_url, username change window (1× / 30 days),
--      hide_not_my_size (My sizes switch), saved_visited_at ("since last visit").
--   6. addresses: multiple shipping addresses with one default (mirrors into
--      profiles.shipping_address so checkout + prepaid labels keep working).
--   7. notification_prefs: per-event channels (offers, offer result, messages,
--      sold, price drops, search alerts, orders).
--   8. reviews: tags + photos, editable for 48h after posting.
--   9. reports: one-tap REPORT on a conversation / listing / comment for the mod queue.
--  10. storage: avatars/{uid}/ prefix on the product-images bucket.
-- Every table keeps RLS; grants are explicit (auto-expose is OFF).
-- db-guard review: REQUIRED before push (ui/archive-redesign).

-- ═══ 1. listings ═══════════════════════════════════════════════════════════════

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS color        TEXT,
  ADD COLUMN IF NOT EXISTS subcategory  TEXT,
  -- Flat measurements in inches, keyed by label: {"PIT TO PIT": 21.5, "LENGTH": 27}
  ADD COLUMN IF NOT EXISTS measurements JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS view_count   INT   NOT NULL DEFAULT 0 CHECK (view_count >= 0);

CREATE INDEX IF NOT EXISTS listings_color_idx       ON listings (color)       WHERE color IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_subcategory_idx ON listings (subcategory) WHERE subcategory IS NOT NULL;

-- Drafts may be partial (the wizard auto-saves as the seller types). Every other
-- status keeps the original invariants, now expressed as status-conditional CHECKs.
ALTER TABLE listings
  ALTER COLUMN title                DROP NOT NULL,
  ALTER COLUMN brand                DROP NOT NULL,
  ALTER COLUMN category             DROP NOT NULL,
  ALTER COLUMN size                 DROP NOT NULL,
  ALTER COLUMN condition_score      DROP NOT NULL,
  ALTER COLUMN price_cents          DROP NOT NULL,
  ALTER COLUMN possession_photo_url DROP NOT NULL;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_condition_score_check;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_price_cents_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_condition_score_check
    CHECK (condition_score IS NULL OR condition_score BETWEEN 1 AND 10),
  ADD CONSTRAINT listings_price_cents_check
    CHECK (price_cents IS NULL OR price_cents > 0),
  ADD CONSTRAINT listings_published_complete_ck CHECK (
    status = 'draft' OR (
      title IS NOT NULL AND brand IS NOT NULL AND category IS NOT NULL AND size IS NOT NULL
      AND condition_score IS NOT NULL AND price_cents IS NOT NULL AND possession_photo_url IS NOT NULL
    )
  );

-- Sold listings stay readable (SHOW ONLY → Sold items; "SOLD 3D AGO" detail pages).
DROP POLICY IF EXISTS "listings_public_read_sold" ON listings;
CREATE POLICY "listings_public_read_sold"
  ON listings FOR SELECT
  USING (status = 'sold');

-- Price history follows the listing's visibility.
DROP POLICY IF EXISTS "price_history_public_read" ON price_history;
CREATE POLICY "price_history_public_read"
  ON price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = price_history.listing_id AND l.status IN ('active', 'sold')
    )
  );

-- View counter: SECURITY DEFINER so anon can bump it; the app rate-limits per session.
CREATE OR REPLACE FUNCTION bump_listing_view(p_listing_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings SET view_count = view_count + 1
  WHERE id = p_listing_id AND status IN ('active', 'sold');
$$;
GRANT EXECUTE ON FUNCTION bump_listing_view(UUID) TO anon, authenticated;

-- ═══ 2. comments: community legit check ═══════════════════════════════════════

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS vote TEXT CHECK (vote IS NULL OR vote IN ('legit', 'flag'));

CREATE INDEX IF NOT EXISTS comments_listing_vote_idx ON comments (listing_id, vote)
  WHERE vote IS NOT NULL AND status = 'visible';

-- Threads stay readable after the item sells.
DROP POLICY IF EXISTS "comments_public_read_visible" ON comments;
CREATE POLICY "comments_public_read_visible"
  ON comments FOR SELECT
  USING (
    status = 'visible'
    AND EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_id AND l.status IN ('active', 'sold')
    )
  );

-- post_comment v3: verified members (not only moderators) can post to the LC thread
-- and attach one LEGIT / FLAG vote. Moderator verdicts are still pinned by admins.
DROP FUNCTION IF EXISTS post_comment(UUID, thread_type, TEXT, BOOLEAN, UUID);
CREATE OR REPLACE FUNCTION post_comment(
  p_listing_id  UUID,
  p_thread_type thread_type,
  p_body        TEXT,
  p_redacted    BOOLEAN DEFAULT false,
  p_parent_id   UUID    DEFAULT NULL,
  p_vote        TEXT    DEFAULT NULL
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_thread_type <> 'lc' THEN
    RAISE EXCEPTION 'general_comments_removed' USING ERRCODE = 'P0001';
  END IF;

  IF p_vote IS NOT NULL AND p_vote NOT IN ('legit', 'flag') THEN
    RAISE EXCEPTION 'invalid_vote' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_profile.banned THEN
    RAISE EXCEPTION 'banned' USING ERRCODE = 'P0001';
  END IF;

  -- Community posting is open to verified members; moderators/admins bypass (alpha).
  IF v_profile.id_verification_status <> 'verified'
     AND NOT (v_profile.is_moderator OR v_profile.role = 'admin') THEN
    RAISE EXCEPTION 'id_verification_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_listing FROM listings WHERE id = p_listing_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found_or_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- One vote per member per listing: a new vote replaces the old one.
  IF p_vote IS NOT NULL THEN
    UPDATE comments SET vote = NULL
    WHERE listing_id = p_listing_id AND author_id = v_user_id AND vote IS NOT NULL;
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM comments
      WHERE id = p_parent_id AND listing_id = p_listing_id AND thread_type = p_thread_type
    ) THEN
      RAISE EXCEPTION 'parent_comment_not_found' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO comments (listing_id, author_id, parent_id, thread_type, body, redacted, source, vote)
  VALUES (p_listing_id, v_user_id, p_parent_id, p_thread_type, p_body, p_redacted, 'human', p_vote)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION post_comment(UUID, thread_type, TEXT, BOOLEAN, UUID, TEXT) TO authenticated;

-- ═══ 3. conversation_reads ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_reads (
  -- CASCADE: a deleted conversation drops its read cursors.
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  -- CASCADE: a deleted profile drops its cursors.
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_reads_user_idx ON conversation_reads (user_id);

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversation_reads_own_select" ON conversation_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT ON conversation_reads TO authenticated;

-- Participant-checked upsert; the only write path.
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation_id AND (c.buyer_id = v_user_id OR c.seller_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, v_user_id, now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION mark_conversation_read(UUID) TO authenticated;

-- Per-conversation unread counts for the caller (header MESSAGES badge, inbox rows,
-- ALL / BUYING / SELLING counts). SECURITY INVOKER: rides on the messages /
-- conversations participant RLS, so it can only ever see the caller's own threads.
CREATE OR REPLACE FUNCTION unread_conversation_counts()
RETURNS TABLE (conversation_id UUID, unread INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.conversation_id, count(*)::INT AS unread
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  LEFT JOIN conversation_reads r
    ON r.conversation_id = c.id AND r.user_id = auth.uid()
  WHERE (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    AND m.sender_id <> auth.uid()
    AND m.created_at > COALESCE(r.last_read_at, 'epoch'::TIMESTAMPTZ)
  GROUP BY m.conversation_id
$$;
GRANT EXECUTE ON FUNCTION unread_conversation_counts() TO authenticated;

-- ═══ 4. saved_searches: alerts toggle + new-since cursor ═════════════════════

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "saved_searches_owner_update" ON saved_searches;
CREATE POLICY "saved_searches_owner_update"
  ON saved_searches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
GRANT UPDATE (alerts_enabled, last_seen_at) ON saved_searches TO authenticated;

-- ═══ 5. profiles: display name, avatar, username window, size switch, saved cursor ═

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name        TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 40),
  ADD COLUMN IF NOT EXISTS avatar_url          TEXT,
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hide_not_my_size    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_visited_at    TIMESTAMPTZ;

-- Public columns (header, cards, threads): display_name + avatar_url.
GRANT SELECT (display_name, avatar_url) ON profiles TO anon;
GRANT SELECT (display_name, avatar_url, username_changed_at, hide_not_my_size, saved_visited_at)
  ON profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, hide_not_my_size, saved_visited_at) ON profiles TO authenticated;

-- Username may change once every 30 days (the UI says so). Enforced in the DB so no
-- client path can skip it; the first change after this migration is always allowed.
CREATE OR REPLACE FUNCTION enforce_username_change_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Account deletion anonymises the handle (deleted_<hex>); that rename is never rate-limited.
  IF NEW.banned_reason = 'account_deleted' THEN
    RETURN NEW;
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - INTERVAL '30 days' THEN
      RAISE EXCEPTION 'username_change_window' USING ERRCODE = 'P0001';
    END IF;
    NEW.username_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_username_window ON profiles;
CREATE TRIGGER profiles_username_window
  BEFORE UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_username_change_window();

-- ═══ 6. addresses ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS addresses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: deleting a profile removes its address book.
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  street1    TEXT        NOT NULL CHECK (char_length(street1) BETWEEN 1 AND 200),
  street2    TEXT        CHECK (street2 IS NULL OR char_length(street2) <= 200),
  city       TEXT        NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  state      TEXT        NOT NULL CHECK (char_length(state) BETWEEN 2 AND 50),
  zip        TEXT        NOT NULL CHECK (char_length(zip) BETWEEN 3 AND 20),
  country    TEXT        NOT NULL DEFAULT 'US' CHECK (country = 'US'),
  is_default BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id, is_default DESC, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_idx ON addresses (user_id) WHERE is_default;

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_owner_select" ON addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "addresses_owner_insert" ON addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "addresses_owner_update" ON addresses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "addresses_owner_delete" ON addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON addresses TO authenticated;

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One default per user: setting a default clears the others, and the default is
-- mirrored into profiles.shipping_address (what checkout + G12 labels read).
CREATE OR REPLACE FUNCTION addresses_sync_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row addresses%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Deleting the default promotes the most recent remaining address.
    IF OLD.is_default THEN
      UPDATE addresses SET is_default = true
      WHERE id = (SELECT id FROM addresses WHERE user_id = OLD.user_id ORDER BY created_at DESC LIMIT 1);
      IF NOT FOUND THEN
        UPDATE profiles SET shipping_address = NULL, ship_from_address = NULL WHERE id = OLD.user_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.is_default THEN
    UPDATE addresses SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default;
    v_row := NEW;
    -- One address book serves both directions (design 2B: "USED FOR PREPAID LABELS
    -- AND RETURNS"): the default is the delivery address AND the ship-from / return
    -- address for prepaid labels.
    UPDATE profiles SET
      shipping_address = jsonb_build_object(
        'name', v_row.name, 'street1', v_row.street1, 'street2', v_row.street2,
        'city', v_row.city, 'state', v_row.state, 'zip', v_row.zip, 'country', v_row.country
      ),
      ship_from_address = jsonb_build_object(
        'name', v_row.name, 'street1', v_row.street1, 'street2', v_row.street2,
        'city', v_row.city, 'state', v_row.state, 'zip', v_row.zip, 'country', v_row.country
      )
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE so the partial unique index never sees two defaults inside one statement.
CREATE TRIGGER addresses_sync_default_trg
  BEFORE INSERT OR UPDATE OF is_default, name, street1, street2, city, state, zip ON addresses
  FOR EACH ROW EXECUTE FUNCTION addresses_sync_default();
CREATE TRIGGER addresses_sync_default_del_trg
  AFTER DELETE ON addresses
  FOR EACH ROW EXECUTE FUNCTION addresses_sync_default();

-- ═══ 7. notification_prefs: per-event channels ═══════════════════════════════

ALTER TABLE notification_prefs
  ADD COLUMN IF NOT EXISTS email_offer_result  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_offer_result   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_sold          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_sold           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_price_drops   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_price_drops    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_search_alerts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_search_alerts  BOOLEAN NOT NULL DEFAULT true;

-- ═══ 8. reviews: tags, photos, 48h edit window ═══════════════════════════════

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS tags       TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photos     TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP FUNCTION IF EXISTS post_review(UUID, INT, TEXT);
CREATE OR REPLACE FUNCTION post_review(
  p_order_id UUID,
  p_stars    INT,
  p_body     TEXT   DEFAULT '',
  p_tags     TEXT[] DEFAULT '{}',
  p_photos   TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_order     orders%ROWTYPE;
  v_direction review_direction;
  v_subject   UUID;
  v_new_id    UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'invalid_stars' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(coalesce(p_body, '')) > 600 THEN
    RAISE EXCEPTION 'body_too_long' USING ERRCODE = 'P0001';
  END IF;
  IF array_length(p_photos, 1) > 3 THEN
    RAISE EXCEPTION 'too_many_photos' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.state <> 'released' THEN
    RAISE EXCEPTION 'order_not_completed' USING ERRCODE = 'P0001';
  END IF;
  IF v_user_id = v_order.buyer_id THEN
    v_direction := 'buyer_to_seller'; v_subject := v_order.seller_id;
  ELSIF v_user_id = v_order.seller_id THEN
    v_direction := 'seller_to_buyer'; v_subject := v_order.buyer_id;
  ELSE
    RAISE EXCEPTION 'not_a_party' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM reviews WHERE order_id = p_order_id AND direction = v_direction) THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO reviews (order_id, reviewer_id, subject_id, direction, stars, body, tags, photos)
  VALUES (p_order_id, v_user_id, v_subject, v_direction, p_stars, coalesce(p_body, ''), coalesce(p_tags, '{}'), coalesce(p_photos, '{}'))
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION post_review(UUID, INT, TEXT, TEXT[], TEXT[]) TO authenticated;

-- Edit your own review within 48 hours of posting.
CREATE OR REPLACE FUNCTION update_review(
  p_review_id UUID,
  p_stars     INT,
  p_body      TEXT   DEFAULT '',
  p_tags      TEXT[] DEFAULT '{}',
  p_photos    TEXT[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_review  reviews%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'invalid_stars' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(coalesce(p_body, '')) > 600 THEN
    RAISE EXCEPTION 'body_too_long' USING ERRCODE = 'P0001';
  END IF;
  IF array_length(p_photos, 1) > 3 THEN
    RAISE EXCEPTION 'too_many_photos' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_review FROM reviews WHERE id = p_review_id;
  IF NOT FOUND OR v_review.reviewer_id <> v_user_id THEN
    RAISE EXCEPTION 'review_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_review.created_at < now() - INTERVAL '48 hours' THEN
    RAISE EXCEPTION 'edit_window_closed' USING ERRCODE = 'P0001';
  END IF;
  UPDATE reviews
  SET stars = p_stars, body = coalesce(p_body, ''), tags = coalesce(p_tags, '{}'),
      photos = coalesce(p_photos, '{}'), updated_at = now()
  WHERE id = p_review_id;
END;
$$;
GRANT EXECUTE ON FUNCTION update_review(UUID, INT, TEXT, TEXT[], TEXT[]) TO authenticated;

-- ═══ 9. reports ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: a deleted reporter drops their reports.
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('conversation', 'listing', 'comment', 'user')),
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS reports_open_idx ON reports (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_type, target_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_owner_insert" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_owner_select" ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
GRANT SELECT, INSERT ON reports TO authenticated;
-- Moderators read/resolve through the service role (admin routes), never directly.

-- ═══ 10. storage: avatars ════════════════════════════════════════════════════

CREATE POLICY "product-images avatar insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND name LIKE 'avatars/' || auth.uid()::text || '/%');
CREATE POLICY "product-images avatar update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND name LIKE 'avatars/' || auth.uid()::text || '/%');
CREATE POLICY "product-images avatar delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND name LIKE 'avatars/' || auth.uid()::text || '/%');
