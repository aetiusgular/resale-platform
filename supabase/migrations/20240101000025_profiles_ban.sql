-- Migration: 20240101000025_profiles_ban
-- Adds a ban flag to profiles for the G6 moderation ban/unban action. Enforcement is in
-- middleware (page requests) + assertNotBanned() on sensitive API routes + at login.
-- Writes go through the service role only (the /api/admin/moderation/ban handler); no new
-- RLS policy needed — existing profile SELECT policies already cover these columns, and a
-- user may see their own banned state. db-guard: additive columns, no data migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banned        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT;

-- Partial index: ban enforcement only ever looks up "is this user banned", so index the
-- rare TRUE rows, not the whole table.
CREATE INDEX IF NOT EXISTS profiles_banned_idx ON profiles (id) WHERE banned;
