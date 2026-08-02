-- Migration: 20240101000022_stateful_tiers
-- Fee model v2 — stateful tier lock. Moves tiering from stateless (recompute the
-- rate at every checkout) to stateful: once a user reaches a better (lower-bps)
-- tier, that RESOLVED RATE is locked for 30 days even if rolling activity later
-- drops. The lock only ever helps the user.
--
-- Per-side resolved bps + lock expiry are stored on `profiles`. NULL bps / NULL
-- until = no lock (new users) → the resolver falls back to the pure activity
-- rate. Written ONLY by the service role in the order-completion updater
-- (lib/tier-progress.ts applyTierProgress); there is no client write policy, and
-- profiles already denies client writes to columns the user shouldn't set.
--
-- Additive + idempotent. No RLS/grant/enum changes. bps columns are INT basis
-- points; lock columns are TIMESTAMPTZ.
--
-- db-guard review: REQUIRED before push.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_buyer_tier_bps   INT,
  ADD COLUMN IF NOT EXISTS current_seller_tier_bps  INT,
  ADD COLUMN IF NOT EXISTS buyer_tier_locked_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_tier_locked_until TIMESTAMPTZ;

-- Range guards 0%..100% (satisfied by NULL, which is the no-lock default).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_current_buyer_tier_bps_range') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_current_buyer_tier_bps_range
      CHECK (current_buyer_tier_bps BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_current_seller_tier_bps_range') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_current_seller_tier_bps_range
      CHECK (current_seller_tier_bps BETWEEN 0 AND 10000);
  END IF;
END $$;
