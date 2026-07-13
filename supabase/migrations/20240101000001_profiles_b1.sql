-- Migration: 20240101000001_profiles_b1
-- Adds B1 fields to profiles:
--   id_verification_status enum, invited_by FK, quick_setup jsonb
-- db-guard reviewed: 2026-07-12

-- ─── Enum ─────────────────────────────────────────────────────────────────────
CREATE TYPE id_verification_status AS ENUM ('unverified', 'pending', 'verified');

-- ─── Alter profiles ───────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS id_verification_status id_verification_status
    NOT NULL DEFAULT 'unverified',
  -- invited_by: FK to profiles (the person whose code this user claimed).
  -- SET NULL on delete: if referrer's profile is deleted, invited_by goes null.
  ADD COLUMN IF NOT EXISTS invited_by UUID
    REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quick_setup JSONB;

-- Index for invited_by (FK column)
CREATE INDEX IF NOT EXISTS profiles_invited_by_idx ON profiles (invited_by);

-- ─── Update grants to include new columns ─────────────────────────────────────
-- Re-grant INSERT/UPDATE to cover the new columns.
-- (Postgres requires re-granting when new columns are added with column-level grants.)
GRANT INSERT (id, username, role, id_verified, id_verification_status, invited_by, quick_setup)
  ON profiles TO authenticated;

GRANT UPDATE (username, id_verified, id_verification_status, invited_by, quick_setup)
  ON profiles TO authenticated;
