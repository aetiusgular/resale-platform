-- Migration: 20240101000010_messages
-- Chat + offers milestone (B6).
--
-- Tables created:
--   conversations   — buyer-seller thread anchored to a listing
--   messages        — chat messages; INSERT only via send_message() RPC
--   offers          — offer state machine (open/countered/accepted/declined/expired/voided)
--   buyer_strikes   — issued when accepted offer goes unpaid after 24h
--
-- buyer_stats view replaced: adds strike_count + pays_fast columns.
--
-- RPCs (SECURITY DEFINER):
--   send_message()           — participant-only INSERT with link-blocking enforcement flag
--   expire_and_void_offers() — pg_cron target: expire open offers, void unpaid accepted offers
--
-- Realtime:
--   messages table added to supabase_realtime publication.
--
-- db-guard review: REQUIRED before push.

-- ─── 1. offer_state enum ────────────────────────────────────────────────────────
CREATE TYPE offer_state AS ENUM (
  'open',       -- awaiting response (24h window)
  'countered',  -- superseded by a counter-offer from the other party
  'accepted',   -- accepted; buyer has 24h to pay
  'declined',   -- explicitly rejected
  'expired',    -- open offer not responded to within 24h
  'voided'      -- accepted but buyer didn't pay within 24h; strike issued
);

-- ─── 2. conversations table ─────────────────────────────────────────────────────
-- One conversation per (listing, buyer, seller) triple.
-- Consent booleans control whether transcript can be used as dispute evidence.
CREATE TABLE conversations (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: preserve conversation history if listing is retained
  listing_id               UUID        NOT NULL
                             REFERENCES listings(id) ON DELETE RESTRICT,
  -- RESTRICT: cannot delete user accounts with conversations
  buyer_id                 UUID        NOT NULL
                             REFERENCES profiles(id) ON DELETE RESTRICT,
  seller_id                UUID        NOT NULL
                             REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Unique triple: one conversation per (listing, buyer, seller)
  UNIQUE (listing_id, buyer_id, seller_id),
  -- Transcript consent: both must be true for dispute use
  comments_consent_buyer   BOOLEAN     NOT NULL DEFAULT false,
  comments_consent_seller  BOOLEAN     NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (FK columns + WHERE clauses in participant RLS)
CREATE INDEX conversations_listing_id_idx  ON conversations (listing_id);
CREATE INDEX conversations_buyer_id_idx    ON conversations (buyer_id);
CREATE INDEX conversations_seller_id_idx   ON conversations (seller_id);
-- Composite for inbox queries: "all conversations where I am buyer OR seller"
CREATE INDEX conversations_buyer_updated_idx  ON conversations (buyer_id, updated_at DESC);
CREATE INDEX conversations_seller_updated_idx ON conversations (seller_id, updated_at DESC);

-- RLS: participants (buyer or seller) only
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_participant_read"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Buyer creates the conversation (seller cannot open a conversation to a buyer)
CREATE POLICY "conversations_buyer_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Each participant may flip only their own consent column.
-- Application enforces column-level updates; DB enforces participant membership.
CREATE POLICY "conversations_participant_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;

-- updated_at trigger
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 3. messages table ──────────────────────────────────────────────────────────
-- INSERT is restricted to the send_message() RPC (SECURITY DEFINER).
-- Client cannot INSERT directly — no INSERT policy granted.
-- redacted=true: body replaced at send time with the policy violation string.
CREATE TABLE messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: conversation deleted → messages deleted (conversation is the unit of deletion)
  conversation_id  UUID        NOT NULL
                     REFERENCES conversations(id) ON DELETE CASCADE,
  -- RESTRICT: sender account deletion blocked while messages exist
  sender_id        UUID        NOT NULL
                     REFERENCES profiles(id) ON DELETE RESTRICT,
  body             TEXT        NOT NULL,
  redacted         BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_id_idx ON messages (conversation_id);
CREATE INDEX messages_conversation_ts_idx ON messages (conversation_id, created_at);
CREATE INDEX messages_sender_id_idx       ON messages (sender_id);

-- RLS: participants of the parent conversation may read
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_participant_read"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
-- No INSERT policy: all inserts go through send_message() SECURITY DEFINER RPC

GRANT SELECT ON messages TO authenticated;

-- Realtime: enable change-data-capture so clients can subscribe to new messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ─── 4. offers table ────────────────────────────────────────────────────────────
-- State changes are ONLY via server routes (no client UPDATE policy).
-- accepted_at is set when state transitions to 'accepted'.
CREATE TABLE offers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: offer history is preserved even if conversation is retained
  conversation_id  UUID        NOT NULL
                     REFERENCES conversations(id) ON DELETE RESTRICT,
  -- RESTRICT: listing deletion blocked if offers exist
  listing_id       UUID        NOT NULL
                     REFERENCES listings(id) ON DELETE RESTRICT,
  -- RESTRICT: user deletion blocked if they have offers
  from_user        UUID        NOT NULL
                     REFERENCES profiles(id) ON DELETE RESTRICT,
  amount_cents     INT         NOT NULL CHECK (amount_cents > 0),
  state            offer_state NOT NULL DEFAULT 'open',
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  accepted_at      TIMESTAMPTZ,  -- set when state → accepted; 24h payment window starts here
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX offers_conversation_id_idx ON offers (conversation_id);
CREATE INDEX offers_listing_id_idx      ON offers (listing_id);
CREATE INDEX offers_from_user_idx       ON offers (from_user);
-- For cron expiry job: scan open offers by expiry
CREATE INDEX offers_open_expires_idx    ON offers (expires_at)
  WHERE state = 'open';
-- For cron void job: scan accepted offers by accepted_at
CREATE INDEX offers_accepted_at_idx     ON offers (accepted_at)
  WHERE state = 'accepted';

-- RLS: participants of the parent conversation may read; NO client writes
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_participant_read"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
-- No INSERT / UPDATE / DELETE for clients — server routes use service_role

GRANT SELECT ON offers TO authenticated;

-- ─── 5. buyer_strikes table ─────────────────────────────────────────────────────
-- Issued by expire_and_void_offers() cron when accepted offer goes unpaid after 24h.
-- Admin and service_role read; users cannot read their own strikes (to avoid gaming).
CREATE TABLE buyer_strikes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: strike record preserved even if user attempts account deletion
  user_id     UUID        NOT NULL
                REFERENCES profiles(id) ON DELETE RESTRICT,
  reason      TEXT        NOT NULL,
  -- SET NULL: if the offer/order is cleaned up, the strike remains for the user
  offer_id    UUID        REFERENCES offers(id) ON DELETE SET NULL,
  order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: one strike per offer (prevents duplicate cron runs issuing double strikes)
CREATE UNIQUE INDEX buyer_strikes_offer_unique
  ON buyer_strikes (offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX buyer_strikes_user_id_idx  ON buyer_strikes (user_id);
CREATE INDEX buyer_strikes_offer_id_idx ON buyer_strikes (offer_id);
CREATE INDEX buyer_strikes_order_id_idx ON buyer_strikes (order_id);

-- RLS: admin can read all; service_role bypasses (used by cron).
-- Intentionally no authenticated-user read: buyers should not see their strike count directly.
-- (It is aggregated in buyer_stats for sellers to see, but buyer_stats is service_role only.)
ALTER TABLE buyer_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer_strikes_admin_read"
  ON buyer_strikes FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
-- No INSERT/UPDATE/DELETE for clients or authenticated — service_role only

-- No GRANT needed: admin policy uses authenticated role, which has no default access.
-- Admin SELECT is via the policy above; only needs a GRANT to resolve.
GRANT SELECT ON buyer_strikes TO authenticated;

-- ─── 6. buyer_stats view (replace) ─────────────────────────────────────────────
-- Extended from B5: adds strike_count and pays_fast columns.
-- Restricted to service_role (same as B5) — prevents dispute/purchase history enumeration.
DROP VIEW IF EXISTS buyer_stats;

CREATE OR REPLACE VIEW buyer_stats AS
SELECT
  p.id                                                     AS user_id,
  p.username,
  p.created_at                                             AS member_since,
  COALESCE(o.purchase_count, 0)                            AS purchase_count,
  COALESCE(d.dispute_count, 0)                             AS dispute_count,
  COALESCE(s.strike_count, 0)                              AS strike_count,
  -- PAYS FAST: majority of offer-sourced orders were paid within 2h of acceptance
  CASE
    WHEN COALESCE(ps.total_offer_payments, 0) = 0 THEN false
    WHEN ps.fast_count * 2 > ps.total_offer_payments      THEN true
    ELSE false
  END                                                      AS pays_fast
FROM profiles p
LEFT JOIN (
  SELECT buyer_id, COUNT(*)::INT AS purchase_count
  FROM orders
  WHERE state IN ('released', 'delivered', 'shipped', 'seller_confirmed', 'paid_held')
  GROUP BY buyer_id
) o ON o.buyer_id = p.id
LEFT JOIN (
  SELECT buyer_id, COUNT(*)::INT AS dispute_count
  FROM disputes
  GROUP BY buyer_id
) d ON d.buyer_id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::INT AS strike_count
  FROM buyer_strikes
  GROUP BY user_id
) s ON s.user_id = p.id
LEFT JOIN (
  -- Join offers→conversations→orders to measure time-to-pay
  SELECT
    c.buyer_id,
    COUNT(*)::INT                                          AS total_offer_payments,
    COUNT(*) FILTER (
      WHERE ord.paid_at IS NOT NULL
        AND ord.paid_at - ofr.accepted_at < INTERVAL '2 hours'
    )::INT                                                 AS fast_count
  FROM offers ofr
  JOIN conversations c ON c.id = ofr.conversation_id
  JOIN orders ord
    ON ord.listing_id = ofr.listing_id
   AND ord.buyer_id   = c.buyer_id
   AND ord.paid_at IS NOT NULL
  WHERE ofr.state = 'accepted'
    AND ofr.accepted_at IS NOT NULL
  GROUP BY c.buyer_id
) ps ON ps.buyer_id = p.id;

-- Restricted to service_role only (same policy as B5)
GRANT SELECT ON buyer_stats TO service_role;

-- ─── 7. send_message() RPC ──────────────────────────────────────────────────────
-- SECURITY DEFINER: runs as postgres, bypasses RLS to INSERT into messages.
-- Manually enforces that auth.uid() is a participant before inserting.
-- The API route performs URL/link blocking BEFORE calling this RPC:
--   if body contains blocked content → pass p_redacted=true, p_body=replacement string.
--   RPC receives the already-scrubbed body; it just records what it gets.
-- Returns the newly inserted message row.
CREATE OR REPLACE FUNCTION send_message(
  p_conversation_id UUID,
  p_body            TEXT,
  p_redacted        BOOLEAN DEFAULT false
)
RETURNS messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant BOOLEAN;
  v_msg         messages;
BEGIN
  -- Verify caller is a participant (buyer or seller) in the conversation
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  ) INTO v_participant;

  IF NOT v_participant THEN
    RAISE EXCEPTION 'send_message: not a participant in conversation %', p_conversation_id;
  END IF;

  -- Insert the message (body already scrubbed / redacted by API layer)
  INSERT INTO messages (conversation_id, sender_id, body, redacted)
  VALUES (p_conversation_id, auth.uid(), p_body, p_redacted)
  RETURNING * INTO v_msg;

  -- Touch conversation updated_at for inbox ordering
  UPDATE conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN v_msg;
END;
$$;

-- Restrict to authenticated only (not public — RPC requires a Supabase session)
REVOKE EXECUTE ON FUNCTION send_message FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION send_message TO authenticated;

-- ─── 8. expire_and_void_offers() ────────────────────────────────────────────────
-- pg_cron target, runs hourly.
-- Phase 1: expire open offers past their expiry window.
-- Phase 2: void accepted offers where buyer hasn't paid within 24h, issue strike.
CREATE OR REPLACE FUNCTION expire_and_void_offers() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Phase 1: expire open offers that have run out of time
  UPDATE offers
  SET state = 'expired'
  WHERE state = 'open'
    AND expires_at < now();

  -- Phase 2: void accepted offers where buyer didn't pay within 24h + issue strike
  FOR r IN
    SELECT ofr.id AS offer_id, c.buyer_id
    FROM offers ofr
    JOIN conversations c ON c.id = ofr.conversation_id
    WHERE ofr.state = 'accepted'
      AND ofr.accepted_at IS NOT NULL
      AND ofr.accepted_at + INTERVAL '24 hours' < now()
      -- Safety: skip if an order already exists (buyer paid)
      AND NOT EXISTS (
        SELECT 1 FROM orders ord
        WHERE ord.listing_id = ofr.listing_id
          AND ord.buyer_id   = c.buyer_id
          AND ord.state NOT IN ('cancelled', 'refunded')
      )
  LOOP
    BEGIN
      -- Void the offer
      UPDATE offers SET state = 'voided' WHERE id = r.offer_id;

      -- Issue a buyer strike (partial unique prevents duplicates)
      INSERT INTO buyer_strikes (user_id, reason, offer_id)
      VALUES (r.buyer_id, 'accepted_offer_unpaid', r.offer_id)
      ON CONFLICT (offer_id) WHERE offer_id IS NOT NULL DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'expire_and_void_offers: failed on offer %: %', r.offer_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_and_void_offers FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION expire_and_void_offers TO service_role;
GRANT  EXECUTE ON FUNCTION expire_and_void_offers TO postgres;

-- ─── 9. pg_cron schedule ────────────────────────────────────────────────────────
-- Unschedule first to make idempotent (cron.schedule does not upsert by name).
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'expire-and-void-offers';

SELECT cron.schedule(
  'expire-and-void-offers',
  '0 * * * *',
  'SELECT expire_and_void_offers()'
);
