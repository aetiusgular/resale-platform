-- Migration: 20240101000028_collusion  (Branch 4 / L2 — Stripe collusion engine)
-- Accumulates each user's Stripe payment fingerprints (card + bank) + billing identity so a
-- pre-payout check can compare buyer vs seller (lib/trust/collusion). A match holds the
-- transfer for admin review instead of releasing funds. Behind COLLUSION_HOLD_ENABLED.
-- Service-role writes; admin reads. db-guard + code-reviewer (money-adjacent).

CREATE TABLE payment_identities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('card', 'bank')),
  fingerprint  TEXT NOT NULL,          -- Stripe's stable per-instrument fingerprint
  billing_name TEXT,
  billing_zip  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, fingerprint)  -- one row per instrument per user (upsert target)
);
CREATE INDEX payment_identities_user_idx ON payment_identities (user_id);
CREATE INDEX payment_identities_fp_idx   ON payment_identities (kind, fingerprint);

ALTER TABLE payment_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_identities_admin_select" ON payment_identities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
GRANT SELECT ON payment_identities TO authenticated;

-- Held-payout marker on orders (set when a collusion match blocks the transfer).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfer_hold_reason TEXT;

-- Append-only collusion flag log for the admin review queue.
CREATE TABLE collusion_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reasons     TEXT[] NOT NULL DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
ALTER TABLE collusion_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collusion_flags_admin_select" ON collusion_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
GRANT SELECT ON collusion_flags TO authenticated;
