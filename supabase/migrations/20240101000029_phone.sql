-- Migration: 20240101000029_phone  (Branch 4 / L1 — phone verification)
-- Stores the verified phone (E.164) + timestamp on profiles and enforces one-number-one-
-- account via a partial UNIQUE index. Writes go through the service role (the verify route).
-- db-guard: additive columns + a partial unique index; no data migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- One account per phone number (only enforced for set values).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON profiles (phone) WHERE phone IS NOT NULL;
