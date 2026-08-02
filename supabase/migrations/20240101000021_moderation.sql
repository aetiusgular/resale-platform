-- Migration: 20240101000021_moderation
-- G6 spine: append-only moderation audit log + the upheld-complaint counter that feeds
-- the seller RISK trigger (lib/trust/risk-signal.ts → sellerRiskFlagged).
--   moderation_actions — every moderator action writes one row; admin SELECT only,
--                        writes ONLY via record_moderation_action() (mirrors listing_flags).
--   profiles.upheld_complaints — incremented by the 'uphold_complaint' action; read by
--                        the risk eval as the "complaints" signal.
-- Side-effecting actions (remove/refund/ban/…) live in their own on-computer handlers
-- that ALSO call record_moderation_action; this migration is the safe, money/auth-free core.
-- db-guard: review before push.

-- ─── 1. upheld-complaint counter (risk signal source) ───────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS upheld_complaints INT NOT NULL DEFAULT 0
    CHECK (upheld_complaints >= 0);

-- ─── 2. moderation_actions audit log ────────────────────────────────────────────
CREATE TABLE moderation_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing','user','message','comment','order')),
  target_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN
                ('remove','restore','warn','ban','unban','refund','uphold_complaint','dismiss')),
  reason      TEXT,
  evidence    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id);
CREATE INDEX moderation_actions_actor_idx  ON moderation_actions (actor_id, created_at DESC);

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- Admin read only. No client write policy — the log is append-only via the RPC below.
CREATE POLICY "moderation_actions_admin_select" ON moderation_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
GRANT SELECT ON moderation_actions TO authenticated;

-- ─── 3. record_moderation_action() RPC ──────────────────────────────────────────
-- SECURITY DEFINER: admin-checked, writes the audit row, and for 'uphold_complaint'
-- against a user, increments profiles.upheld_complaints (the risk signal). Side-effecting
-- handlers (remove/refund/ban) call this to record, then apply their own effect.
CREATE OR REPLACE FUNCTION record_moderation_action(
  p_target_type TEXT,
  p_target_id   UUID,
  p_action      TEXT,
  p_reason      TEXT  DEFAULT NULL,
  p_evidence    JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_role  TEXT;
  v_id    UUID;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_actor;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO moderation_actions (actor_id, target_type, target_id, action, reason, evidence)
  VALUES (v_actor, p_target_type, p_target_id, p_action, p_reason, COALESCE(p_evidence, '{}'::jsonb))
  RETURNING id INTO v_id;

  IF p_action = 'uphold_complaint' AND p_target_type = 'user' THEN
    UPDATE profiles SET upheld_complaints = upheld_complaints + 1 WHERE id = p_target_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_moderation_action(TEXT, UUID, TEXT, TEXT, JSONB) TO authenticated;
