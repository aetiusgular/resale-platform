-- Migration: 20240101000050_international_shipping
-- International shipping (sell page redesign A).
--
--   * US seller → US buyer is unchanged: system-derived listings.shipping_cents + the prepaid
--     EasyPost label the platform buys (G11/G12). label_mode = 'platform'.
--   * Every other lane is priced by the seller per region (listings.intl_shipping) and the
--     seller buys their own label; the shipping the buyer paid is added to the seller's
--     transfer. label_mode = 'seller'. Region keys + rules live in lib/shipping-regions.ts.
--   * Address book goes international: any ISO country except restricted destinations
--     (app-validated per country in lib/addresses.ts); state / postal code may be blank where
--     a country has none.
--
-- NOT purely additive — owner sign-off required: section 1 REPLACES the addresses CHECKs
-- (country = 'US', state length 2..50, zip length 3..20) with international ones, so non-US
-- addresses can reach profiles.shipping_address / ship_from_address. The G12 label path
-- refuses any non-US address (lib/fulfillment buyLabelForOrder → 'not_domestic').
--
-- Every existing row keeps its meaning: addresses stay 'US', listings get intl_shipping '{}'
-- (US only) and ships_from 'US', orders / checkout sessions get label_mode 'platform'. No new
-- tables, so no new RLS policies; the new columns ride the existing table grants/policies.
--
-- Locking: new CHECKs on listings / orders / checkout_sessions are added NOT VALID (existing
-- rows all hold the constant defaults) and validated in 20240101000051 in a separate
-- transaction, so this migration never scans those tables under an ACCESS EXCLUSIVE lock.
-- Apply BEFORE deploying the app code that reads the new columns.

SET lock_timeout = '5s';

-- ─── 1. Address book: any supported country ─────────────────────────────────────
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_country_check;
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_state_check;
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_zip_check;
ALTER TABLE addresses
  -- Restricted destinations mirror lib/countries.ts RESTRICTED_COUNTRIES.
  ADD CONSTRAINT addresses_country_check CHECK (country ~ '^[A-Z]{2}$' AND country NOT IN ('CU', 'IR', 'KP', 'SY', 'RU', 'BY')),
  ADD CONSTRAINT addresses_state_check   CHECK (char_length(state) <= 50),
  ADD CONSTRAINT addresses_zip_check     CHECK (char_length(zip) <= 20);

-- The default-address mirror must also refire when only the country changes.
DROP TRIGGER IF EXISTS addresses_sync_default_trg ON addresses;
CREATE TRIGGER addresses_sync_default_trg
  BEFORE INSERT OR UPDATE OF is_default, name, street1, street2, city, state, zip, country ON addresses
  FOR EACH ROW EXECUTE FUNCTION addresses_sync_default();

-- ─── 2. Listings: where it ships from + per-region seller rates ─────────────────
-- Shape check for intl_shipping: an object whose keys are known region keys and whose values
-- are integer cents in 0..50000. Mirrors cleanIntlShipping() so a direct client write through
-- RLS (drafts) can never store something checkout would misprice. CASE guarantees evaluation
-- order, so a non-object or a string value is a clean CHECK failure (23514), never a cast error.
CREATE OR REPLACE FUNCTION public.intl_shipping_is_valid(j JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE WHEN jsonb_typeof(j) <> 'object' THEN false ELSE NOT EXISTS (
    SELECT 1 FROM jsonb_each(j) AS e(k, v)
    WHERE CASE
      WHEN e.k NOT IN ('canada', 'north_america', 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other') THEN true
      WHEN jsonb_typeof(e.v) <> 'number' THEN true
      ELSE (e.v)::numeric <> trunc((e.v)::numeric) OR (e.v)::numeric NOT BETWEEN 0 AND 50000
    END
  ) END;
$$;
-- CHECK constraints run with the writer's privileges; draft writes are `authenticated`.
GRANT EXECUTE ON FUNCTION public.intl_shipping_is_valid(JSONB) TO authenticated;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ships_from    TEXT  NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS intl_shipping JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_ships_from_check' AND conrelid = 'public.listings'::regclass) THEN
    ALTER TABLE listings ADD CONSTRAINT listings_ships_from_check CHECK (ships_from ~ '^[A-Z]{2}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_intl_shipping_check' AND conrelid = 'public.listings'::regclass) THEN
    ALTER TABLE listings ADD CONSTRAINT listings_intl_shipping_check CHECK (public.intl_shipping_is_valid(intl_shipping)) NOT VALID;
  END IF;
END $$;
-- No index: nothing filters on these columns yet (a "ships to" browse filter would add one).

-- ─── 3. Checkout sessions: the lane that was priced + where it goes ─────────────
ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS label_mode      TEXT  NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS shipping_region TEXT,
  ADD COLUMN IF NOT EXISTS ship_to_address JSONB;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_label_mode_check' AND conrelid = 'public.checkout_sessions'::regclass) THEN
    ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_label_mode_check
      CHECK (label_mode IN ('platform', 'seller')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_sessions_shipping_region_check' AND conrelid = 'public.checkout_sessions'::regclass) THEN
    ALTER TABLE checkout_sessions ADD CONSTRAINT checkout_sessions_shipping_region_check CHECK (
      (label_mode = 'platform' AND (shipping_region IS NULL OR shipping_region = 'domestic'))
      OR (label_mode = 'seller' AND shipping_region IN ('canada', 'north_america', 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other'))
    ) NOT VALID;
  END IF;
END $$;

-- ─── 4. Orders: snapshot of the lane (drives payout + who buys the label) ───────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS label_mode      TEXT NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS shipping_region TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_label_mode_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_label_mode_check CHECK (label_mode IN ('platform', 'seller')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_region_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shipping_region_check CHECK (
      (label_mode = 'platform' AND (shipping_region IS NULL OR shipping_region = 'domestic'))
      OR (label_mode = 'seller' AND shipping_region IN ('canada', 'north_america', 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other'))
    ) NOT VALID;
  END IF;
  -- Seller-label orders pay the shipping line out with the item (lib/fees transferCentsFor).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_label_transfer_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_seller_label_transfer_check CHECK (
      label_mode = 'platform' OR transfer_cents = item_cents - seller_fee_cents + shipping_cents
    ) NOT VALID;
  END IF;
END $$;

RESET lock_timeout;
