-- Migration: 20240101000027_verification  (G4 — Persona ID verification)
-- Adds verification bookkeeping on profiles + an append-only provider-event log used for
-- webhook idempotency and audit. The id_verification_status enum ('unverified'|'pending'|
-- 'verified') already exists (0001); the signed Persona webhook flips it to 'verified'.
-- Writes are service-role only (the webhook); admins may read the log. db-guard.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS id_verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS persona_inquiry_id TEXT;

CREATE TABLE verification_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL DEFAULT 'persona',
  event_id     TEXT NOT NULL,                 -- provider event id (idempotency anchor)
  event_name   TEXT,                          -- e.g. inquiry.approved / inquiry.declined
  inquiry_id   TEXT,
  reference_id TEXT,                          -- our user id, as passed to Persona
  status       TEXT,                          -- approved / declined / completed / …
  payload      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)                 -- replayed webhook ⇒ 23505 ⇒ no-op
);
CREATE INDEX verification_events_reference_idx ON verification_events (reference_id, created_at DESC);

ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification_events_admin_select" ON verification_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
GRANT SELECT ON verification_events TO authenticated;
