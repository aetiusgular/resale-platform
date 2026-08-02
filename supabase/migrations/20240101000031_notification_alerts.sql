-- Migration: 20240101000031_notification_alerts  (G8 saved-search dispatch)
-- Adds an 'alerts' notification category (saved-search matches, and future size alerts)
-- to notification_prefs. Additive + idempotent; email/push opt-OUT (default true), matching
-- the other categories. RLS + table grants already cover the new columns (table-level).
-- db-guard: additive columns only, no policy/grant/data change.

ALTER TABLE notification_prefs
  ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_alerts  BOOLEAN NOT NULL DEFAULT true;
