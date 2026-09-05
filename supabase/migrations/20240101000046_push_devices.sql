-- Migration: 20240101000046_push_devices
-- Native push registry for the archive-ios (and later archive-android) apps.
--
-- push_subscriptions (0026) holds Web Push endpoints; APNs/FCM device tokens have a different
-- shape (one opaque token per app install), so they get their own table instead of overloading
-- that one. lib/notify/dispatch.ts fans the `push` channel out to both.
--
-- A token belongs to at most one user at a time: (platform, token) is UNIQUE and a sign-in on a
-- shared device re-points the row to the new user (upsert on that key). FK → profiles
-- ON DELETE CASCADE: deleting the account removes its devices (account deletion flow).
-- Every table keeps RLS; grants are explicit (auto-expose is OFF).
-- db-guard review: REQUIRED before push (feat/mobile-api).

CREATE TABLE IF NOT EXISTS push_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: an account's devices go with it.
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  -- APNs device token (hex) or FCM registration token. Opaque; never logged in full.
  -- APNs tokens are 64 hex chars, FCM registration tokens ~150–200; 512 is headroom and index-safe.
  token        TEXT NOT NULL CHECK (char_length(token) BETWEEN 16 AND 512),
  -- App build that registered the token (CFBundleVersion / versionCode) — payload compatibility.
  app_build    TEXT CHECK (app_build IS NULL OR char_length(app_build) <= 32),
  locale       TEXT CHECK (locale IS NULL OR char_length(locale) <= 16),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, token)
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices (user_id);
-- (platform, token) is covered by the UNIQUE constraint's index.

ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;

-- A user manages their own devices; the service role reads all to send pushes.
CREATE POLICY "push_devices_owner_select" ON push_devices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_devices_owner_insert" ON push_devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_devices_owner_update" ON push_devices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_devices_owner_delete" ON push_devices FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON push_devices TO authenticated;

CREATE TRIGGER push_devices_updated_at
  BEFORE UPDATE ON push_devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
