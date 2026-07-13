-- Migration: 20240101000009_orders
-- The money milestone: orders, escrow state machine, disputes, pg_cron auto-release.
--
-- Tables created:
--   checkout_sessions  — transient listing lock + fee snapshot during payment
--   orders             — authoritative order record post-payment
--   order_events       — append-only audit log (idempotency anchor for webhooks)
--   disputes           — buyer-initiated dispute with photo evidence
--
-- Profiles additions:
--   payouts_enabled, stripe_connect_account_id, shipping_address
--
-- listing_status extended:
--   'pending_escrow' added (listing locked while payment in flight)
--
-- RPCs (SECURITY DEFINER, execute REVOKED from public):
--   transition_order()              — enforces legal state edges, atomic
--   auto_release_delivered_orders() — pg_cron target for 3-day auto-release
--   release_expired_checkouts()     — pg_cron target for 30-min checkout expiry
--
-- db-guard review: REQUIRED before push.

-- ─── 1. Profiles additions ──────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payouts_enabled           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address          JSONB;

-- Partial index: fast lookup of sellers who are payout-ready (checkout gate)
CREATE INDEX IF NOT EXISTS profiles_payouts_enabled_idx
  ON profiles (id)
  WHERE payouts_enabled = true;

-- Service role may write payouts_enabled and stripe_connect_account_id via webhook
-- (never exposed to authenticated clients directly — no GRANT needed here)

-- ─── 2. listing_status: add pending_escrow ─────────────────────────────────────
-- This value is set server-side only when a checkout session starts.
-- Cannot be set by sellers (listings_seller_update policy only allows
-- draft/pending_review transitions).
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'pending_escrow' AFTER 'active';

-- ─── 3. Tighten listings_seller_update policy ─────────────────────────────────
-- B4 deferred: old policy allowed status != 'active', which permitted sellers
-- to self-set pending_escrow, sold, removed.
-- New policy: sellers may only edit rows in draft/pending_review and may only
-- set status within that same set.
DROP POLICY IF EXISTS "listings_seller_update" ON listings;
CREATE POLICY "listings_seller_update"
  ON listings FOR UPDATE
  TO authenticated
  USING  (auth.uid() = seller_id AND status IN ('draft', 'pending_review'))
  WITH CHECK (
    auth.uid() = seller_id
    AND status IN ('draft', 'pending_review')
  );

-- ─── 4. Enums ──────────────────────────────────────────────────────────────────

-- Order state machine edges (see transition_order() for legal transitions):
-- paid_held → seller_confirmed → shipped → delivered → released
--                              → cancelled                (seller/system)
--                                         → disputed  → released | refunded
-- Any state → cancelled (system/webhook on payment_failed)
-- Any state → refunded  (admin after dispute)
CREATE TYPE order_state AS ENUM (
  'paid_held',
  'seller_confirmed',
  'shipped',
  'delivered',
  'released',
  'disputed',
  'refunded',
  'cancelled'
);

-- Who triggered a state transition (for audit and blame)
CREATE TYPE event_source AS ENUM (
  'webhook',  -- Stripe webhook
  'admin',    -- Admin action via UI
  'cron',     -- pg_cron scheduled job
  'user'      -- Buyer or seller direct action
);

-- ─── 5. checkout_sessions table ────────────────────────────────────────────────
-- Transient record: created when checkout starts, deleted when payment
-- succeeds or fails. Primary key is the Stripe PaymentIntent ID.
-- UNIQUE on listing_id ensures only one pending checkout per listing at a time.
-- All monetary fields are the server-computed fee snapshot — never trust client.
-- RLS: buyer reads own session only. NO writes from clients (service role only).
CREATE TABLE checkout_sessions (
  stripe_payment_intent_id  TEXT        PRIMARY KEY,
  -- CASCADE: if listing is hard-deleted, session is cleaned up
  listing_id                UUID        NOT NULL UNIQUE
                              REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id                  UUID        NOT NULL
                              REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id                 UUID        NOT NULL
                              REFERENCES profiles(id) ON DELETE CASCADE,
  -- Fee snapshot (server-computed, immutable after creation)
  item_cents                INT         NOT NULL CHECK (item_cents > 0),
  buyer_fee_cents           INT         NOT NULL CHECK (buyer_fee_cents >= 0),
  seller_fee_cents          INT         NOT NULL CHECK (seller_fee_cents >= 0),
  shipping_cents            INT         NOT NULL CHECK (shipping_cents >= 0),
  total_cents               INT         NOT NULL CHECK (total_cents > 0),
  -- Session expires after 30 minutes; pg_cron releases the listing lock
  expires_at                TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 minutes',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX checkout_sessions_expires_at_idx ON checkout_sessions (expires_at);
-- FK indexes: required for RLS policy scans (auth.uid() = buyer_id) and future joins
CREATE INDEX checkout_sessions_buyer_id_idx   ON checkout_sessions (buyer_id);
CREATE INDEX checkout_sessions_seller_id_idx  ON checkout_sessions (seller_id);

-- RLS
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions_buyer_read_own"
  ON checkout_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);
-- No INSERT/UPDATE/DELETE for clients — service role only

GRANT SELECT ON checkout_sessions TO authenticated;

-- ─── 6. orders table ────────────────────────────────────────────────────────────
-- Authoritative order record, created by payment_intent.succeeded webhook.
-- All writes are via service role (webhooks, server routes).
-- UNIQUE on stripe_payment_intent_id prevents duplicate webhook processing.
-- Partial unique index on listing_id prevents two open orders for same listing.
CREATE TABLE orders (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: cannot delete a listing that has an order (preserve history)
  listing_id                UUID        NOT NULL
                              REFERENCES listings(id) ON DELETE RESTRICT,
  -- RESTRICT: cannot delete user accounts with open orders
  buyer_id                  UUID        NOT NULL
                              REFERENCES profiles(id) ON DELETE RESTRICT,
  seller_id                 UUID        NOT NULL
                              REFERENCES profiles(id) ON DELETE RESTRICT,

  -- ─ Fee snapshot (locked at payment time, immutable) ─
  item_cents                INT         NOT NULL CHECK (item_cents > 0),
  buyer_fee_cents           INT         NOT NULL CHECK (buyer_fee_cents >= 0),
  seller_fee_cents          INT         NOT NULL CHECK (seller_fee_cents >= 0),
  shipping_cents            INT         NOT NULL CHECK (shipping_cents >= 0),
  total_cents               INT         NOT NULL CHECK (total_cents > 0),
  -- Payout to seller = item_cents - seller_fee_cents (shipping passthrough tracked separately)
  transfer_cents            INT         NOT NULL CHECK (transfer_cents > 0),

  -- ─ Stripe ─
  stripe_payment_intent_id  TEXT        NOT NULL UNIQUE,
  stripe_transfer_id        TEXT,       -- populated when funds released

  -- ─ Shipping ─
  carrier                   TEXT,
  tracking_number           TEXT,
  shipping_address          JSONB,      -- snapshot of buyer address at order time

  -- ─ State ─
  state                     order_state NOT NULL DEFAULT 'paid_held',

  -- ─ Transition timestamps (set by transition_order(), one per state) ─
  paid_at                   TIMESTAMPTZ,
  seller_confirmed_at       TIMESTAMPTZ,
  shipped_at                TIMESTAMPTZ,
  delivered_at              TIMESTAMPTZ,
  released_at               TIMESTAMPTZ,
  disputed_at               TIMESTAMPTZ,
  refunded_at               TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger (reuse set_updated_at from listings migration)
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX orders_buyer_id_idx              ON orders (buyer_id);
CREATE INDEX orders_seller_id_idx             ON orders (seller_id);
CREATE INDEX orders_listing_id_idx            ON orders (listing_id);
CREATE INDEX orders_state_idx                 ON orders (state);
CREATE INDEX orders_delivered_at_idx          ON orders (delivered_at)
  WHERE state = 'delivered';
-- Partial unique: only one non-terminal order per listing at a time
CREATE UNIQUE INDEX orders_listing_unique_open
  ON orders (listing_id)
  WHERE state NOT IN ('released', 'cancelled', 'refunded');

-- RLS: buyers and sellers read own orders; NO client writes (service role only)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_participant_read"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "orders_admin_read"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT SELECT ON orders TO authenticated;

-- ─── 7. order_events table ──────────────────────────────────────────────────────
-- Append-only audit log. No UPDATE or DELETE ever.
-- stripe_event_id UNIQUE is the idempotency anchor: inserting with a duplicate
-- stripe_event_id fails with unique violation → webhook handler returns 200 (already processed).
CREATE TABLE order_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: if order is deleted (shouldn't happen but defensive), events go with it
  order_id         UUID         NOT NULL
                     REFERENCES orders(id) ON DELETE CASCADE,
  from_state       order_state,            -- NULL for initial paid_held transition
  to_state         order_state  NOT NULL,
  source           event_source NOT NULL,
  -- Idempotency anchor: Stripe event ID, unique — prevents replay
  stripe_event_id  TEXT         UNIQUE,
  payload          JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX order_events_order_id_idx       ON order_events (order_id);
CREATE INDEX order_events_stripe_event_idx   ON order_events (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- RLS: participants read their own order's events; append-only (no UPDATE/DELETE)
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_events_participant_read"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

CREATE POLICY "order_events_admin_read"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT SELECT ON order_events TO authenticated;

-- ─── 8. disputes table ─────────────────────────────────────────────────────────
-- Buyer-initiated. Requires ≥1 photo. Must be opened within 72h of delivered_at.
-- Presence of an unresolved dispute (resolved_at IS NULL) freezes auto-release.
-- UNIQUE on order_id: only one dispute per order.
CREATE TABLE disputes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: order deleted → dispute deleted (won't happen in practice)
  order_id      UUID        NOT NULL UNIQUE
                  REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id      UUID        NOT NULL
                  REFERENCES profiles(id) ON DELETE RESTRICT,
  -- At least 1 photo required; enforced at both API layer and DB layer
  photos        TEXT[]      NOT NULL DEFAULT '{}'
                              CHECK (array_length(photos, 1) >= 1),
  description   TEXT        NOT NULL,
  -- Resolution: 'release' = seller wins, 'refund' = buyer wins
  resolution    TEXT        CHECK (resolution IN ('release', 'refund')),
  -- SET NULL: if admin account is deleted, resolution is preserved with null admin
  resolved_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX disputes_order_id_idx    ON disputes (order_id);
CREATE INDEX disputes_buyer_id_idx    ON disputes (buyer_id);
CREATE INDEX disputes_resolved_at_idx ON disputes (resolved_at)
  WHERE resolved_at IS NULL;

-- RLS: buyer and seller of the relevant order can read; admin can read all; no direct writes
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_participant_read"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

CREATE POLICY "disputes_admin_read"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT SELECT ON disputes TO authenticated;

-- ─── 9. buyer_stats view ───────────────────────────────────────────────────────
-- Shown to sellers before accepting: purchase count, dispute count, member tenure.
-- Accessible to authenticated users for any buyer_id.
CREATE OR REPLACE VIEW buyer_stats AS
SELECT
  p.id                                                  AS user_id,
  p.username,
  p.created_at                                          AS member_since,
  COALESCE(o.purchase_count, 0)                         AS purchase_count,
  COALESCE(d.dispute_count, 0)                          AS dispute_count
FROM profiles p
LEFT JOIN (
  SELECT buyer_id, COUNT(*)::INT AS purchase_count
  FROM orders
  WHERE state IN ('released', 'delivered', 'shipped', 'seller_confirmed')
  GROUP BY buyer_id
) o ON o.buyer_id = p.id
LEFT JOIN (
  SELECT buyer_id, COUNT(*)::INT AS dispute_count
  FROM disputes
  GROUP BY buyer_id
) d ON d.buyer_id = p.id;

-- buyer_stats is restricted to service_role only.
-- Exposing dispute/purchase counts to all authenticated users would be a privacy disclosure
-- (any user could enumerate another user's dispute history by user_id).
-- Server components that display buyer stats must use createServiceClientRaw().
GRANT SELECT ON buyer_stats TO service_role;

-- ─── 10. transition_order() — atomic state machine ─────────────────────────────
-- Legal transitions:
--   paid_held        → seller_confirmed, cancelled
--   seller_confirmed → shipped, cancelled
--   shipped          → delivered
--   delivered        → released, disputed
--   disputed         → released, refunded
--
-- If stripe_event_id is provided and already exists in order_events, function
-- silently returns (idempotent replay protection).
-- Illegal transitions are rejected with RAISE EXCEPTION after logging a rejection
-- event (with null stripe_event_id to avoid unique conflict on replay).
-- All mutations inside a single function call = atomic (no partial state).
CREATE OR REPLACE FUNCTION transition_order(
  p_order_id      UUID,
  p_to_state      order_state,
  p_source        event_source,
  p_stripe_event  TEXT    DEFAULT NULL,
  p_payload       JSONB   DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current order_state;
  v_allowed order_state[];
BEGIN
  -- Idempotency: if this Stripe event was already processed, silently return
  IF p_stripe_event IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM order_events WHERE stripe_event_id = p_stripe_event
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Lock the order row to prevent concurrent transitions
  SELECT state INTO v_current
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found: %', p_order_id;
  END IF;

  -- Legal edge table
  v_allowed := CASE v_current
    WHEN 'paid_held'        THEN ARRAY['seller_confirmed', 'cancelled']::order_state[]
    WHEN 'seller_confirmed' THEN ARRAY['shipped', 'cancelled']::order_state[]
    WHEN 'shipped'          THEN ARRAY['delivered']::order_state[]
    WHEN 'delivered'        THEN ARRAY['released', 'disputed']::order_state[]
    WHEN 'disputed'         THEN ARRAY['released', 'refunded']::order_state[]
    ELSE                         ARRAY[]::order_state[]
  END;

  IF NOT (p_to_state = ANY(v_allowed)) THEN
    -- Log the rejection (stripe_event_id NULL to avoid unique conflict)
    INSERT INTO order_events (order_id, from_state, to_state, source, payload)
    VALUES (p_order_id, v_current, p_to_state, p_source,
            COALESCE(p_payload, '{}'::jsonb) || '{"rejected":true}'::jsonb);
    RAISE EXCEPTION 'illegal transition: % → % for order %',
      v_current, p_to_state, p_order_id;
  END IF;

  -- Update order state + relevant timestamp atomically
  UPDATE orders SET
    state               = p_to_state,
    paid_at             = CASE WHEN p_to_state = 'paid_held'        THEN COALESCE(paid_at, now())             ELSE paid_at             END,
    seller_confirmed_at = CASE WHEN p_to_state = 'seller_confirmed' THEN COALESCE(seller_confirmed_at, now()) ELSE seller_confirmed_at END,
    shipped_at          = CASE WHEN p_to_state = 'shipped'          THEN COALESCE(shipped_at, now())          ELSE shipped_at          END,
    delivered_at        = CASE WHEN p_to_state = 'delivered'        THEN COALESCE(delivered_at, now())        ELSE delivered_at        END,
    released_at         = CASE WHEN p_to_state = 'released'         THEN COALESCE(released_at, now())         ELSE released_at         END,
    disputed_at         = CASE WHEN p_to_state = 'disputed'         THEN COALESCE(disputed_at, now())         ELSE disputed_at         END,
    refunded_at         = CASE WHEN p_to_state = 'refunded'         THEN COALESCE(refunded_at, now())         ELSE refunded_at         END,
    cancelled_at        = CASE WHEN p_to_state = 'cancelled'        THEN COALESCE(cancelled_at, now())        ELSE cancelled_at        END,
    updated_at          = now()
  WHERE id = p_order_id;

  -- Append audit event
  INSERT INTO order_events (order_id, from_state, to_state, source, stripe_event_id, payload)
  VALUES (p_order_id, v_current, p_to_state, p_source, p_stripe_event, p_payload);
END;
$$;

-- Restrict: only service_role (via server routes) and postgres (pg_cron) can call
REVOKE EXECUTE ON FUNCTION transition_order FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION transition_order TO service_role;

-- ─── 11. auto_release_delivered_orders() ───────────────────────────────────────
-- Called by pg_cron every hour. Transitions orders from delivered → released
-- where 3 days have elapsed and no active (unresolved) dispute exists.
-- The state machine check in transition_order ensures idempotency.
-- NOTE: This only changes DB state. The Stripe transfer for auto-released orders
-- is processed separately by the /api/cron/process-transfers route (Vercel cron).
CREATE OR REPLACE FUNCTION auto_release_delivered_orders() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id
    FROM orders o
    WHERE o.state = 'delivered'
      AND o.delivered_at < now() - INTERVAL '3 days'
      -- Extra safety: don't release if an active dispute exists on this order
      AND NOT EXISTS (
        SELECT 1 FROM disputes d
        WHERE d.order_id = o.id
          AND d.resolved_at IS NULL
      )
  LOOP
    BEGIN
      PERFORM transition_order(
        r.id,
        'released',
        'cron',
        NULL,
        '{"reason":"auto_release_3d"}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log and continue: a single failing transition must not abort the entire cron run
      RAISE WARNING 'auto_release_delivered_orders: failed to release order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_release_delivered_orders FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION auto_release_delivered_orders TO service_role;
-- pg_cron runs as the postgres superuser; explicit grant makes the intent clear
-- and ensures correct behaviour if the postgres role ever loses superuser on managed Supabase
GRANT  EXECUTE ON FUNCTION auto_release_delivered_orders TO postgres;

-- ─── 12. release_expired_checkouts() ───────────────────────────────────────────
-- Called by pg_cron every 5 minutes. Releases pending_escrow listing lock
-- when the 30-minute checkout window expires (payment never completed).
CREATE OR REPLACE FUNCTION release_expired_checkouts() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Release listing lock back to active for expired sessions
  UPDATE listings
  SET status = 'active'
  WHERE status = 'pending_escrow'
    AND id IN (
      SELECT listing_id FROM checkout_sessions WHERE expires_at < now()
    );

  -- Clean up expired sessions
  DELETE FROM checkout_sessions WHERE expires_at < now();
END;
$$;

REVOKE EXECUTE ON FUNCTION release_expired_checkouts FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION release_expired_checkouts TO service_role;
-- pg_cron runs as the postgres superuser; explicit grant makes the intent clear
GRANT  EXECUTE ON FUNCTION release_expired_checkouts TO postgres;

-- ─── 13. pg_cron schedules ─────────────────────────────────────────────────────
-- Fail loudly if pg_cron extension is not available.
-- AUTO_RELEASE_INTERVAL: 3 days — defined in lib/orders.ts as the canonical constant.
-- Change the interval there and re-migrate if policy changes.
--
-- Unschedule first to make this block idempotent (cron.schedule does NOT upsert —
-- running it twice would create duplicate jobs with the same name).
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname IN ('auto-release-delivered-orders', 'release-expired-checkouts');

-- Auto-release delivered orders after 3 days
SELECT cron.schedule(
  'auto-release-delivered-orders',
  '0 * * * *',
  'SELECT auto_release_delivered_orders()'
);

-- Release expired checkout locks every 5 minutes
SELECT cron.schedule(
  'release-expired-checkouts',
  '*/5 * * * *',
  'SELECT release_expired_checkouts()'
);
