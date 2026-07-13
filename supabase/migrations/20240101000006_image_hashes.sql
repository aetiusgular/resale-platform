-- Migration: 20240101000006_image_hashes
-- Stores perceptual (blockhash) fingerprint per image slot per listing.
-- Used by the anti-slop layer for duplicate detection across accounts.
--
-- RLS: ENABLED with NO policies → deny all client access.
--      Service role (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS; all reads/writes
--      from the API route use the service client. Zero client visibility.
-- db-guard reviewed: 2026-07-12

CREATE TABLE image_hashes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL
               REFERENCES listings(id)
               ON DELETE CASCADE,
  -- CASCADE: deleting a listing removes all its image hashes.
  slot       TEXT NOT NULL,   -- FRONT|BACK|TAG|DETAIL|FLAW|POSSESSION
  hash       TEXT NOT NULL,   -- 64-char lowercase hex (256-bit blockhash16)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, slot)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- listing_id FK
CREATE INDEX image_hashes_listing_id_idx ON image_hashes (listing_id);
-- Slot + hash index: near-duplicate lookup scans (slot, hash) pairs
CREATE INDEX image_hashes_slot_hash_idx  ON image_hashes (slot, hash);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE image_hashes ENABLE ROW LEVEL SECURITY;
-- No policies → deny all. Service role bypasses RLS entirely.

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- Grants are necessary for the service_role JWT to operate via PostgREST.
-- RLS (above) blocks all anon/authenticated access regardless of these grants.
GRANT SELECT, INSERT, DELETE ON image_hashes TO authenticated;
