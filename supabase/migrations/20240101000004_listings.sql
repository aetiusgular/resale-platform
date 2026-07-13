-- Migration: 20240101000004_listings
-- Creates the listings table, RLS, indexes.
-- Status enum: draft / pending_review / active / sold / removed
-- RLS: anon+auth read active only; seller CRUD own (cannot self-approve);
--      admin all.
-- Grants: explicit — auto-expose is OFF on this project.
-- db-guard reviewed: 2026-07-12

-- ─── Enum ─────────────────────────────────────────────────────────────────────
CREATE TYPE listing_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'sold',
  'removed'
);

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE listings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id            UUID NOT NULL
                         REFERENCES profiles(id)
                         ON DELETE CASCADE,
  -- CASCADE: deleting a profile cascades to their listings.
  title                TEXT NOT NULL,
  brand                TEXT NOT NULL,
  category             TEXT NOT NULL,
  size                 TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  condition_score      INT NOT NULL CHECK (condition_score BETWEEN 1 AND 10),
  condition_notes      JSONB NOT NULL DEFAULT '{}',
  price_cents          INT NOT NULL CHECK (price_cents > 0),
  -- images[1..6] map to FRONT/BACK/TAG/DETAIL/FLAW/POSSESSION slots.
  -- Stored as empty strings for unfilled slots to maintain 6-element length.
  images               TEXT[] NOT NULL DEFAULT '{}',
  possession_photo_url TEXT NOT NULL,
  status               listing_status NOT NULL DEFAULT 'draft',
  rejection_reason     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX listings_status_created_idx ON listings (status, created_at DESC);
CREATE INDEX listings_seller_id_idx      ON listings (seller_id);
CREATE INDEX listings_brand_idx          ON listings (brand);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated: read active listings only (public browsing)
CREATE POLICY "listings_public_read_active"
  ON listings FOR SELECT
  USING (status = 'active');

-- Seller: read their own listings at any status (e.g. to see pending/rejection)
CREATE POLICY "listings_seller_read_own"
  ON listings FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

-- Seller: insert their own listing, status restricted to draft or pending_review
CREATE POLICY "listings_seller_insert"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND status IN ('draft', 'pending_review')
  );

-- Seller: update their own listing, but cannot self-approve (status 'active' blocked)
CREATE POLICY "listings_seller_update"
  ON listings FOR UPDATE
  TO authenticated
  USING  (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND status != 'active'
  );

-- Seller: delete own drafts only
CREATE POLICY "listings_seller_delete"
  ON listings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = seller_id
    AND status = 'draft'
  );

-- Admin: unrestricted access — covers approve (status→active) and reject
CREATE POLICY "listings_admin_all"
  ON listings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- auto-expose is OFF — grants are explicit
GRANT SELECT ON listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON listings TO authenticated;
