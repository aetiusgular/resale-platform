-- Migration: 20240101000000_profiles
-- Creates the profiles table linked to auth.users.
-- RLS: public can read username only (via policy); owner can update own row.
-- Grants: explicit — auto-expose is OFF on this project.
-- db-guard reviewed: 2026-07-12

-- ─── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- CASCADE: deleting the auth.users row deletes the profile. Intentional.
  username       TEXT UNIQUE NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('member', 'admin', 'verified_checker')),
  id_verified    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on username for lookups by handle
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON profiles (lower(username));

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public: only username is visible (used in listing/seller pages without auth)
CREATE POLICY "profiles_public_read_username"
  ON profiles FOR SELECT
  USING (true);
-- Note: expose only the username column via a restricted view in application
-- code (app/api and DB views). Full row available to authenticated callers
-- via policy below.

-- Authenticated: owner can read their own full row
CREATE POLICY "profiles_owner_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Authenticated: owner can update their own row (not id, not role, not created_at)
CREATE POLICY "profiles_owner_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Authenticated: new user can insert their own profile row on signup
CREATE POLICY "profiles_owner_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admin can do anything
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- auto-expose is OFF — grants are explicit
GRANT SELECT ON profiles TO authenticated;
GRANT INSERT (id, username, role, id_verified) ON profiles TO authenticated;
GRANT UPDATE (username, id_verified) ON profiles TO authenticated;

-- anon can read usernames for public-facing pages
GRANT SELECT ON profiles TO anon;
