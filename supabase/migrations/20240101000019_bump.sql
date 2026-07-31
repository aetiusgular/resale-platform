-- Migration: 20240101000019_bump
-- G7 bump/refresh: adds bump tracking to listings + a bump-aware browse index.
--   bumped_at NULL          = never bumped (first bump is always eligible)
--   bumped_price_cents      = list price snapshot at the last bump; feeds the
--                             >=10% markdown early-bump path (lib/bump/eligibility.ts)
-- Writes happen via the SERVICE role in POST /api/listings/[id]/bump — the seller
-- RLS WITH CHECK blocks updates that keep status='active', so no new client write
-- policy is added here (reads stay covered by the existing public/seller SELECT policies).
-- db-guard: review before push.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS bumped_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bumped_price_cents INT
    CHECK (bumped_price_cents IS NULL OR bumped_price_cents > 0);

-- Bump-aware ordering for browse: active listings, freshest bump first, then recency.
-- NULLS LAST so never-bumped listings sort below bumped ones but stay ordered by
-- created_at. Matches the ORDER BY in app/api/browse/route.ts (default sort).
CREATE INDEX IF NOT EXISTS listings_status_bumped_idx
  ON listings (status, bumped_at DESC NULLS LAST, created_at DESC);
