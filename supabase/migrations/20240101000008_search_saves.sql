-- Migration: 20240101000008_search_saves
-- Adds: full-text search (tsvector), price history, saves, saved searches,
--       department + is_price_dropped columns on listings, sizes on profiles.
-- db-guard reviewed: 2026-07-13

-- ─── 1. Profiles: add sizes jsonb ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '{}';

-- Column-level grants: existing INSERT/UPDATE grants are column-specific (migration 000001)
GRANT INSERT (sizes) ON profiles TO authenticated;
GRANT UPDATE (sizes) ON profiles TO authenticated;

-- ─── 2. Listings: department, search_vector, saves_count, is_price_dropped ────

-- Department: top-level categorisation (menswear / womenswear / unisex)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'menswear'
  CHECK (department IN ('menswear', 'womenswear', 'unisex'));
CREATE INDEX IF NOT EXISTS listings_department_idx ON listings (department);

-- Full-text search: generated tsvector from title (A), brand (B), description (C)
-- English dictionary; stored so GIN index is always current.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS listings_search_vector_idx ON listings USING GIN (search_vector);

-- Denormalised save count — maintained by trigger on saves INSERT/DELETE
ALTER TABLE listings ADD COLUMN IF NOT EXISTS saves_count INT NOT NULL DEFAULT 0;

-- Price-drop flag — set true when price is reduced; never reset to false.
-- Used for "SHOW ONLY: Price Dropped" filter without requiring a JOIN.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_price_dropped BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS listings_saves_count_idx    ON listings (saves_count DESC);
CREATE INDEX IF NOT EXISTS listings_is_price_dropped_idx ON listings (is_price_dropped)
  WHERE is_price_dropped = true;

-- ─── 3. price_history table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: deleting a listing removes its price history.
  listing_id      UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  old_price_cents INT         NOT NULL CHECK (old_price_cents > 0),
  new_price_cents INT         NOT NULL CHECK (new_price_cents > 0),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_listing_id_idx ON price_history (listing_id);
CREATE INDEX IF NOT EXISTS price_history_changed_at_idx ON price_history (changed_at DESC);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Public read: price history is visible for active listings only.
CREATE POLICY "price_history_public_read"
  ON price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = price_history.listing_id AND l.status = 'active'
    )
  );

-- anon read: price history for active listings is public data; supports
-- unauthenticated browse-page price-drop display (RLS policy enforces active-only).
GRANT SELECT ON price_history TO anon;
GRANT SELECT ON price_history TO authenticated;
-- Note: CREATE INDEX without CONCURRENTLY locks the listings table briefly.
-- Pre-production data volume is negligible; acceptable for B4. Revisit at beta scale.

-- Trigger function: record price change + set is_price_dropped.
-- SECURITY DEFINER: the function runs as the owner (bypasses RLS) so it can
--   INSERT into price_history (no INSERT policy — deny-all to clients) and
--   UPDATE listings.is_price_dropped (bypasses listings_seller_update RLS).
-- SET search_path: prevents search-path injection attacks.
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.price_cents <> OLD.price_cents THEN
    INSERT INTO price_history (listing_id, old_price_cents, new_price_cents)
    VALUES (NEW.id, OLD.price_cents, NEW.price_cents);

    -- Mark listing as price-dropped when price decreases (never un-marked).
    IF NEW.price_cents < OLD.price_cents THEN
      UPDATE listings SET is_price_dropped = true WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger fires on price_cents column changes only, avoiding false positives.
CREATE TRIGGER listings_price_change_trigger
  AFTER UPDATE OF price_cents ON listings
  FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- ─── 4. saves table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saves (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: deleting a user removes their saves.
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- CASCADE: deleting a listing removes its saves.
  listing_id UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS saves_user_id_idx    ON saves (user_id);
CREATE INDEX IF NOT EXISTS saves_listing_id_idx ON saves (listing_id);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

-- Authenticated: owner can read, insert, and delete their own saves.
-- No anon access. No saves visible cross-user.
CREATE POLICY "saves_owner_select"
  ON saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saves_owner_insert"
  ON saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saves_owner_delete"
  ON saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON saves TO authenticated;

-- Trigger function: maintain saves_count on listings.
-- SECURITY DEFINER: bypasses listings_seller_update RLS so any user's save
--   can increment/decrement the count on any listing.
-- SET search_path: prevents search-path injection attacks.
CREATE OR REPLACE FUNCTION update_saves_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE listings SET saves_count = saves_count + 1 WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE listings SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;  -- AFTER trigger: return value ignored for statement-level
END;
$$;

CREATE TRIGGER saves_count_trigger
  AFTER INSERT OR DELETE ON saves
  FOR EACH ROW EXECUTE FUNCTION update_saves_count();

-- ─── 5. saved_searches table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_searches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: deleting a user removes their saved searches.
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Stores the complete filter state as a JSONB object.
  -- Shape: { q?, dept?, cat?, size?, brand?, min_price?, max_price?, cond?, verified?, dropped?, sort? }
  query      JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches (user_id);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Owner-only access: users can only read/create/delete their own saved searches.
CREATE POLICY "saved_searches_owner_select"
  ON saved_searches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_searches_owner_insert"
  ON saved_searches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_searches_owner_delete"
  ON saved_searches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON saved_searches TO authenticated;
