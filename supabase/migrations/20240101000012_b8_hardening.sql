-- Migration: 20240101000012_b8_hardening
-- B8 security hardening and feature additions.
--
-- Changes:
--   1. waitlist table — persists pre-alpha email signups
--   2. comments.body — enforce 2000-char max at the DB level (was only in API layer)
--   3. profiles anon grant — restrict to (id, username) only; full row was exposed
--
-- db-guard review: B8

-- ─── 1. Waitlist table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  -- SET NULL is not applicable here: emails are the value, not FK.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_unique UNIQUE (email),
  CONSTRAINT waitlist_email_format CHECK (char_length(email) <= 254 AND email LIKE '%@%')
);

-- Index for admin lookup by email and date
CREATE INDEX IF NOT EXISTS waitlist_email_idx    ON waitlist (email);
CREATE INDEX IF NOT EXISTS waitlist_created_idx  ON waitlist (created_at DESC);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- No authenticated read — only service_role (admin dashboard)
-- Waitlist is read via admin API using createServiceClient()
CREATE POLICY "waitlist_service_only"
  ON waitlist FOR ALL
  USING (false)
  WITH CHECK (false);

-- Explicit grant: only service_role can touch this table
-- (anon/authenticated blocked by RLS above)
GRANT INSERT ON waitlist TO anon;
GRANT INSERT ON waitlist TO authenticated;
-- Note: INSERT is permitted only via service_role in the API route, which bypasses RLS.
-- The RLS policy denies all client-initiated operations. The route uses createServiceClientRaw().

-- ─── 2. Comment body max length ───────────────────────────────────────────────
-- The API already enforces 2000 chars; this adds a belt-and-suspenders DB check.
ALTER TABLE comments
  ADD CONSTRAINT comments_body_max_length CHECK (char_length(body) <= 2000);

-- ─── 3. Profiles anon grant: restrict to id + username only ──────────────────
-- Bug: migration 000000 granted SELECT on ALL columns to anon, exposing
-- id_verification_status, role, quick_setup etc. to unauthenticated clients.
-- Fix: revoke the broad grant and re-grant only the two needed columns.
-- (The profiles_public_read_username RLS policy stays; it controls row visibility.)
REVOKE SELECT ON profiles FROM anon;
GRANT SELECT (id, username) ON profiles TO anon;
