-- Migration: 20240101000020_reviews_follows
-- G9: follows + post-transaction reviews.
--   follows  — client-writable via RLS (following is not gated like reviews)
--   reviews  — public read; writes ONLY through post_review() SECURITY DEFINER, which
--              enforces: reviewer is a party to a RELEASED order, in their direction,
--              once per direction. Mirrors lib/reviews/eligibility.ts (canLeaveReview).
-- Seller rating = reviews where subject_id = seller AND direction = 'buyer_to_seller'.
-- db-guard: review before push.

-- ─── 1. follows ─────────────────────────────────────────────────────────────────
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_follower_idx  ON follows (follower_id);
CREATE INDEX follows_following_idx ON follows (following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Authenticated may read follows (follower counts + "sellers I follow" are not secret).
CREATE POLICY "follows_auth_read" ON follows FOR SELECT TO authenticated USING (true);
-- A user may follow/unfollow only as themselves.
CREATE POLICY "follows_insert_own" ON follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

GRANT SELECT, INSERT, DELETE ON follows TO authenticated;

-- ─── 2. reviews ─────────────────────────────────────────────────────────────────
CREATE TYPE review_direction AS ENUM ('buyer_to_seller', 'seller_to_buyer');

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction   review_direction NOT NULL,
  stars       INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, direction)  -- one review per direction per order
);
CREATE INDEX reviews_subject_idx ON reviews (subject_id, direction);
CREATE INDEX reviews_order_idx   ON reviews (order_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public read (reputation is public). NO client write policy — writes go through the RPC.
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (true);
GRANT SELECT ON reviews TO anon;
GRANT SELECT ON reviews TO authenticated;

-- ─── 3. post_review() RPC ───────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS for the INSERT; all authorization is explicit here.
-- Enforces the same rule as lib/reviews/eligibility.ts: a party to a RELEASED order may
-- review the counterparty, once per direction. Body is filtered by the TS layer first
-- (same pattern as post_comment / send_message).
CREATE OR REPLACE FUNCTION post_review(
  p_order_id UUID,
  p_stars    INT,
  p_body     TEXT DEFAULT ''
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

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Reviews only follow a completed (funds-released) transaction.
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

  INSERT INTO reviews (order_id, reviewer_id, subject_id, direction, stars, body)
  VALUES (p_order_id, v_user_id, v_subject, v_direction, p_stars, p_body)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION post_review(UUID, INT, TEXT) TO authenticated;
