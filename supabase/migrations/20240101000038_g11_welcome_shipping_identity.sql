-- Migration: 20240101000038_g11_welcome_shipping_identity
-- Phase G11 — onboarding welcome ramp + category shipping margin + identity locks.
--
-- Locked decisions (2026-08-17):
--   1. Welcome ramp: a seller's first 10 NON-CANCELLED sales are 0% commission (seller
--      covers Stripe processing only); sale 11+ uses the existing tier system. The fee
--      model that priced an order is snapshotted on the order (orders.fee_mode).
--   2. NO $2/month seller fee and NO seller_monthly_fees ledger (intentionally NOT
--      created). The ~$2/active-seller/month Stripe Connect cost is recovered on EVERY
--      sale through the category-derived shipping margin (listings.shipping_cents), not a
--      monthly charge.
--   3. Sellers cannot set shipping. listings.shipping_cents is system-derived from the
--      listing category ( max(EasyPost worst-zone quote, category floor) + $2 ), stored at
--      listing time. shipping_source records whether a live quote or the floor was used.
--   4. Identity: the payout BANK fingerprint is HARD-locked to one account (partial unique
--      index). The CARD fingerprint stays soft (flagged in app, NOT unique — shared
--      household cards). Phone is already unique (profiles_phone_unique).
--
-- profiles.lifetime_sales_count is the O(1) welcome/tier gate, maintained by trigger:
-- +1 on order insert (orders are born non-cancelled), -1 when an order transitions to
-- 'cancelled'. Refunded/disputed orders still count as a used slot — only an outright
-- cancellation returns it. This is deliberate anti-abuse (refund-to-stay-in-welcome is
-- self-defeating: a refund costs the seller the sale).

-- ─── 1. Welcome/tier gate: cached non-cancelled sales count per seller ─────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_sales_count INT NOT NULL DEFAULT 0;

-- Backfill from existing orders (BEFORE the trigger exists, so no double count).
UPDATE profiles p
   SET lifetime_sales_count = sub.cnt
  FROM (
    SELECT seller_id, COUNT(*)::INT AS cnt
      FROM orders
     WHERE state <> 'cancelled'
     GROUP BY seller_id
  ) sub
 WHERE p.id = sub.seller_id
   AND p.lifetime_sales_count <> sub.cnt;

CREATE OR REPLACE FUNCTION bump_lifetime_sales_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- so a non-owner-triggered state change (buyer confirm / admin /
SET search_path = public  -- cron) can still update the seller's cached count past RLS
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'cancelled' THEN
      UPDATE profiles SET lifetime_sales_count = lifetime_sales_count + 1
       WHERE id = NEW.seller_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.state <> 'cancelled' AND NEW.state = 'cancelled' THEN
      UPDATE profiles SET lifetime_sales_count = GREATEST(0, lifetime_sales_count - 1)
       WHERE id = NEW.seller_id;
    ELSIF OLD.state = 'cancelled' AND NEW.state <> 'cancelled' THEN
      -- defensive: a resurrected order re-consumes a slot (should not occur in practice)
      UPDATE profiles SET lifetime_sales_count = lifetime_sales_count + 1
       WHERE id = NEW.seller_id;
    END IF;
  END IF;
  RETURN NULL;  -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS orders_lifetime_sales_count ON orders;
CREATE TRIGGER orders_lifetime_sales_count
  AFTER INSERT OR UPDATE OF state ON orders
  FOR EACH ROW EXECUTE FUNCTION bump_lifetime_sales_count();

-- ─── 2. Order fee-model snapshot (welcome vs tier) ─────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fee_mode TEXT NOT NULL DEFAULT 'tier';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fee_mode_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_fee_mode_check
      CHECK (fee_mode IN ('welcome','tier'));
  END IF;
END $$;

-- ─── 3. System-derived shipping on listings (sellers cannot set it) ────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS shipping_cents  INT,
  ADD COLUMN IF NOT EXISTS shipping_source TEXT NOT NULL DEFAULT 'preset';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_shipping_source_check') THEN
    ALTER TABLE listings ADD CONSTRAINT listings_shipping_source_check
      CHECK (shipping_source IN ('preset','quote'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_shipping_cents_nonneg') THEN
    ALTER TABLE listings ADD CONSTRAINT listings_shipping_cents_nonneg
      CHECK (shipping_cents IS NULL OR shipping_cents >= 0);
  END IF;
END $$;

-- Backfill existing listings with the category floor + $2 margin (source 'preset').
-- MUST stay in sync with SHIPPING_PRESETS floors + SHIPPING_MARGIN_CENTS(200) in
-- lib/shipping.ts. Values below are floor + 200.
UPDATE listings SET shipping_cents = CASE category
    WHEN 'Tops'        THEN  900
    WHEN 'Sportswear'  THEN 1000
    WHEN 'Bottoms'     THEN 1100
    WHEN 'Denim'       THEN 1200
    WHEN 'Knitwear'    THEN 1300
    WHEN 'Accessories' THEN 1400
    WHEN 'Tailoring'   THEN 1600
    WHEN 'Outerwear'   THEN 1700
    WHEN 'Footwear'    THEN 2200
    ELSE 2200  -- 'Other' + any unknown category → catch-all ceiling
  END
 WHERE shipping_cents IS NULL;

-- ─── 4. Identity lock: one payout bank per account (HARD). Card stays soft. ─────
-- Kills welcome-phase farming (a fresh real bank per 10 sales isn't worth it). Card
-- fingerprints are intentionally NOT unique (shared household cards) — soft-flagged in app.
-- NOTE: if two existing accounts already share a bank fingerprint this index creation will
-- fail; on a pre-launch DB there is no such data. Dedupe first if it ever does.
CREATE UNIQUE INDEX IF NOT EXISTS payment_identities_bank_fp_unique
  ON payment_identities (fingerprint)
  WHERE kind = 'bank';
