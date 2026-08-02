-- Migration: 20240101000026_notifications  (G2)
-- In-app notification inbox + per-user channel preferences + web-push subscriptions.
-- Dispatch happens at the application layer (lib/notify) after each event, behind
-- NOTIFICATIONS_ENABLED; the service role writes notifications, users read/ack their own.
-- db-guard: new tables + RLS only, no changes to existing tables.

-- ─── 1. notifications (in-app inbox) ────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- recipient
  type       TEXT NOT NULL,                                             -- NotifyEvent (offer_received, sale, …)
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  url        TEXT,                                                      -- deep link (e.g. /orders/<id>)
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- Recipient may read + mark-read their own; writes are service-role only.
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, UPDATE ON notifications TO authenticated;

-- ─── 2. notification_prefs (per-category channel opt-in) ────────────────────────
-- One row per user. Categories: offers | orders | messages. in-app is always on;
-- email/push are opt-OUT (default true) per category. Absent row ⇒ all defaults.
CREATE TABLE notification_prefs (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_offers   BOOLEAN NOT NULL DEFAULT true,
  push_offers    BOOLEAN NOT NULL DEFAULT true,
  email_orders   BOOLEAN NOT NULL DEFAULT true,
  push_orders    BOOLEAN NOT NULL DEFAULT true,
  email_messages BOOLEAN NOT NULL DEFAULT true,
  push_messages  BOOLEAN NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_prefs_rw_own" ON notification_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON notification_prefs TO authenticated;

-- ─── 3. push_subscriptions (web-push endpoints) ─────────────────────────────────
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- A user manages their own subscriptions; the service role reads all to send pushes.
CREATE POLICY "push_subs_rw_own" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;
