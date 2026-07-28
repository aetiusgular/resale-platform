-- Migration: 20240101000018_fee_bps_snapshot
-- Snapshots the resolved per-side fee RATE (basis points) next to the existing
-- cents amounts, for audit + tier-aware receipts. Written server-side into
-- checkout_sessions at PaymentIntent creation (app/api/checkout/route.ts), then
-- copied onto the order by the Stripe webhook — which reads fees from the
-- session, never from PI metadata (anti-tamper).
--
-- Additive + idempotent. No RLS/grant/enum changes. Columns are INT basis points.
--
-- Columns are NULLABLE on purpose: NOT NULL would break checkout/webhook inserts
-- if this migration ever ran ahead of the F3 code deploy. Tighten to NOT NULL in
-- a later migration once tiered checkout is live everywhere.
--
-- db-guard review: REQUIRED before push.

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS buyer_fee_bps  INT,
  ADD COLUMN IF NOT EXISTS seller_fee_bps INT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_fee_bps  INT,
  ADD COLUMN IF NOT EXISTS seller_fee_bps INT;

-- Historical orders were charged the legacy flat 2% (200 bps). Backfill so
-- receipts render the rate actually charged.
UPDATE orders
   SET buyer_fee_bps = 200, seller_fee_bps = 200
 WHERE buyer_fee_bps IS NULL OR seller_fee_bps IS NULL;

-- Range guards 0%..100% (CHECK is satisfied by NULL, which is fine here).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_fee_bps_range') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_buyer_fee_bps_range
      CHECK (buyer_fee_bps BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_fee_bps_range') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_seller_fee_bps_range
      CHECK (seller_fee_bps BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_buyer_fee_bps_range') THEN
    ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_buyer_fee_bps_range
      CHECK (buyer_fee_bps BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_seller_fee_bps_range') THEN
    ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_seller_fee_bps_range
      CHECK (seller_fee_bps BETWEEN 0 AND 10000);
  END IF;
END $$;
