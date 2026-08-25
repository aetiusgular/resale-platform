-- Migration: 20240101000042_bump_creation_anchor
-- Creation counts as the first bump (founder decision 2026-08-25).
--
-- G7 left bumped_at NULL until a seller's first manual bump, and the default browse
-- ordering (bumped_at DESC NULLS LAST) therefore sorted every never-bumped listing —
-- including brand-new ones — below anything ever bumped. Anchoring the bump state at
-- creation makes bumped_at ≈ created_at for fresh listings, so:
--   • new listings enter the feed at the top (recency preserved),
--   • a bump re-freshens a listing exactly as if freshly listed,
--   • the first FREE bump unlocks 7 days after listing (or early via the ≥10%
--     price-drop rule in lib/bump/eligibility.ts, whose reference price now starts
--     at the original list price).
--
-- Mechanism: a BEFORE INSERT trigger (covers the API route, seed/fixture scripts, and
-- any future insert path) + a one-time backfill for existing rows. The trigger only
-- fills NULLs (COALESCE), never overrides an explicitly supplied value. Plain invoker
-- function — it touches only NEW, needs no SECURITY DEFINER and no new RLS policy
-- (the eligibility check and the bump UPDATE still run through the service role in
-- POST /api/listings/[id]/bump, unchanged).
-- db-guard: review before push.

CREATE OR REPLACE FUNCTION listings_set_bump_anchor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.bumped_at          := COALESCE(NEW.bumped_at, now());
  NEW.bumped_price_cents := COALESCE(NEW.bumped_price_cents, NEW.price_cents);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_bump_anchor ON listings;
CREATE TRIGGER listings_bump_anchor
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_set_bump_anchor();

-- Backfill: anchor every pre-existing row at its creation time / current price.
-- (UPDATEs don't fire the INSERT trigger; price_cents is validated > 0 at insert, so
-- the bumped_price_cents CHECK (> 0) cannot trip.)
UPDATE listings
SET bumped_at          = COALESCE(bumped_at, created_at),
    bumped_price_cents = COALESCE(bumped_price_cents, price_cents)
WHERE bumped_at IS NULL OR bumped_price_cents IS NULL;

-- No new index: listings_status_bumped_idx (0019) still matches the bump-aware branch
-- of the default ordering; the boosted_until head of the page-1 ORDER BY is a top-N
-- sort over a small active set at alpha scale. Revisit if browse slows at volume.
