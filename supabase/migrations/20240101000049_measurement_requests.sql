-- Migration: 20240101000049_measurement_requests
-- Buyer "REQUEST MEASUREMENTS" on a listing that has none yet (PDP R5B empty state).
-- One structured request per buyer per listing; the seller is notified, and when they
-- add measurements the requesters are notified back. Additive — no existing table changes.
-- Every table keeps RLS; grants are explicit (auto-expose is OFF).

CREATE TABLE IF NOT EXISTS measurement_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: a deleted listing or requester drops the request.
  listing_id   UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fulfilled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One request per buyer per listing (the button is idempotent).
  UNIQUE (listing_id, requester_id)
);
-- Seller fan-out on fulfilment + the per-listing tally read the open requests by listing.
CREATE INDEX IF NOT EXISTS measurement_requests_listing_idx
  ON measurement_requests (listing_id) WHERE fulfilled_at IS NULL;

ALTER TABLE measurement_requests ENABLE ROW LEVEL SECURITY;
-- The requester owns their row: they can create it and read it back (the PDP shows
-- REQUESTED once they have). Everything else (the seller's tally, the fulfilment
-- fan-out) runs through the service role in server routes, never the browser.
CREATE POLICY "measurement_requests_owner_insert" ON measurement_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "measurement_requests_owner_select" ON measurement_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_id);
GRANT SELECT, INSERT ON measurement_requests TO authenticated;
