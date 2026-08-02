-- Migration: 20240101000032_authentication  (G5 authentication badge)
-- Adds a per-listing authentication lifecycle: 'none' (default) → 'pending' (in the review
-- queue) → 'authenticated' | 'rejected'. High-value or already-flagged listings enter
-- 'pending' at publish (lib/authbadge/screen.ts); an admin decides; 'authenticated' shows the
-- badge and powers the browse filter. Additive + idempotent. Writes go through the service
-- role (screening hook + admin endpoints); there is no client write path to these columns.
-- db-guard: additive columns + partial indexes; no RLS/grant/data change.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS authentication_status  TEXT NOT NULL DEFAULT 'none'
    CHECK (authentication_status IN ('none', 'pending', 'authenticated', 'rejected')),
  ADD COLUMN IF NOT EXISTS authentication_reasons TEXT[] NOT NULL DEFAULT '{}';

-- Admin review queue: the rare 'pending' rows.
CREATE INDEX IF NOT EXISTS listings_auth_pending_idx ON listings (authentication_status)
  WHERE authentication_status = 'pending';

-- Browse filter: authenticated active listings.
CREATE INDEX IF NOT EXISTS listings_authenticated_idx ON listings (authentication_status)
  WHERE authentication_status = 'authenticated';
