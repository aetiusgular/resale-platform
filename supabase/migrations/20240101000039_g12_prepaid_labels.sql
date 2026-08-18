-- Migration: 20240101000039_g12_prepaid_labels
-- Phase G12 — prepaid EasyPost labels. Adds the label lifecycle to orders, a COMPLETE ship-to
-- snapshot (a label needs name+street, which the checkout PII-minimal snapshot lacks), a seller
-- ship-from address, and an idempotent shipping_events table for the EasyPost tracker webhook.
-- Dormant behind SHIPPING_LABELS_ENABLED. No fee/escrow columns change — shipping is already
-- collected at checkout (listings.shipping_cents); the label is bought FROM that money.

-- ─── 1. Order label lifecycle ─────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_label_url        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_label_cost_cents INT,
  ADD COLUMN IF NOT EXISTS easypost_shipment_id      TEXT,
  ADD COLUMN IF NOT EXISTS easypost_tracker_id       TEXT,
  ADD COLUMN IF NOT EXISTS label_purchased_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_refunded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ship_to_address           JSONB;   -- complete recipient snapshot
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_label_cost_nonneg') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_label_cost_nonneg
      CHECK (shipping_label_cost_cents IS NULL OR shipping_label_cost_cents >= 0);
  END IF;
END $$;
-- One shipment per order (a bought label binds 1:1). Partial unique on non-null shipment id.
CREATE UNIQUE INDEX IF NOT EXISTS orders_easypost_shipment_unique
  ON orders (easypost_shipment_id) WHERE easypost_shipment_id IS NOT NULL;

-- ─── 2. Seller ship-from address (a return address ≠ their buying address) ─────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ship_from_address JSONB;

-- ─── 3. Idempotent EasyPost tracker webhook audit ─────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL DEFAULT 'easypost',
  event_id      TEXT NOT NULL,              -- provider event id (idempotency anchor)
  event_name    TEXT,
  tracking_code TEXT,
  status        TEXT,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)               -- replayed webhook ⇒ 23505 ⇒ no-op
);
CREATE INDEX IF NOT EXISTS shipping_events_tracking_idx ON shipping_events (tracking_code);
ALTER TABLE shipping_events ENABLE ROW LEVEL SECURITY;
-- Service-role only (webhook writes); no client policy → no authenticated access.
