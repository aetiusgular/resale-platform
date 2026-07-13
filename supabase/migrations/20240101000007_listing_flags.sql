-- Migration: 20240101000007_listing_flags
-- Stores automated moderation flags raised by the anti-slop layer.
--
-- Flag types:
--   'duplicate'        — perceptual hash matched >= 2 slots from another seller
--   'keyword_stuffing' — brand-count or blocked-pattern lint warning
--
-- RLS:
--   authenticated admin SELECT (for the review queue UI)
--   No INSERT/UPDATE/DELETE policies — only service role writes flags.
-- db-guard reviewed: 2026-07-12

CREATE TABLE listing_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL
               REFERENCES listings(id)
               ON DELETE CASCADE,
  -- CASCADE: deleting a listing removes its flags.
  type       TEXT NOT NULL CHECK (type IN ('duplicate', 'keyword_stuffing')),
  evidence   JSONB NOT NULL DEFAULT '{}',
  -- For 'duplicate': { matched_listing_ids: string[], per_slot_distances: [...] }
  -- For 'keyword_stuffing': { violations: [{ code, message }] }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX listing_flags_listing_id_idx ON listing_flags (listing_id);
CREATE INDEX listing_flags_type_idx       ON listing_flags (type);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE listing_flags ENABLE ROW LEVEL SECURITY;

-- Admin: read all flags (for the review queue)
CREATE POLICY "listing_flags_admin_select"
  ON listing_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for client roles.
-- The service role bypasses RLS for all write operations.

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- authenticated role can SELECT (RLS policy above limits to admin only).
-- Service role bypasses RLS and uses the postgres superuser for writes.
GRANT SELECT, INSERT, DELETE ON listing_flags TO authenticated;
