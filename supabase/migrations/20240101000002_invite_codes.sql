-- Migration: 20240101000002_invite_codes
-- Invite codes table + atomic claim RPC + code generation helper.
-- RLS: owners read their own generated codes only.
-- db-guard reviewed: 2026-07-12

-- ─── Enum ─────────────────────────────────────────────────────────────────────
CREATE TYPE invite_code_status AS ENUM ('unused', 'claimed');

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  code         TEXT PRIMARY KEY,
  -- generated_by: profile that created this code.
  -- CASCADE: deleting a profile cascades to their generated codes.
  generated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- used_by: profile that claimed this code (unique — one code, one claimer).
  -- SET NULL: if the claimer's profile is deleted, this goes null (code remains claimed).
  used_by      UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  status       invite_code_status NOT NULL DEFAULT 'unused',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at   TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS invite_codes_generated_by_idx ON invite_codes (generated_by);
CREATE INDEX IF NOT EXISTS invite_codes_used_by_idx ON invite_codes (used_by);
CREATE INDEX IF NOT EXISTS invite_codes_status_idx ON invite_codes (status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Owner can read codes they generated
CREATE POLICY "invite_codes_owner_select"
  ON invite_codes FOR SELECT
  TO authenticated
  USING (generated_by = auth.uid());

-- No direct INSERT/UPDATE/DELETE from client — all mutations via SECURITY DEFINER RPCs

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- auto-expose OFF — explicit grants
GRANT SELECT ON invite_codes TO authenticated;
-- No INSERT/UPDATE/DELETE grants to authenticated — RPCs use SECURITY DEFINER

-- ─── RPC: claim_invite_code ───────────────────────────────────────────────────
-- Atomically claims a code. Returns {success, error}.
-- Case-insensitive: input is uppercased before lookup.
-- Uses SELECT ... FOR UPDATE to prevent concurrent double-claims.
CREATE OR REPLACE FUNCTION claim_invite_code(p_code TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row  invite_codes%ROWTYPE;
  v_normalized TEXT;
BEGIN
  v_normalized := upper(trim(p_code));

  -- Lock the code row for update to prevent concurrent claims
  SELECT * INTO v_code_row
    FROM invite_codes
   WHERE code = v_normalized
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'code not found');
  END IF;

  IF v_code_row.status = 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'code already used');
  END IF;

  -- Prevent self-claiming (user claiming their own generated code)
  IF v_code_row.generated_by = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot claim your own code');
  END IF;

  -- Atomic claim
  UPDATE invite_codes
     SET status     = 'claimed',
         used_by    = p_user_id,
         claimed_at = now()
   WHERE code = v_normalized;

  -- Stamp the profile with invited_by
  UPDATE profiles
     SET invited_by = v_code_row.generated_by
   WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'error', null);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION claim_invite_code(TEXT, UUID) TO authenticated;

-- ─── RPC: generate_member_codes ───────────────────────────────────────────────
-- Generates p_count invite codes for p_user_id.
-- Called server-side after account activation.
-- Uses pgcrypto for randomness (extension enabled on this project).
CREATE OR REPLACE FUNCTION generate_member_codes(p_user_id UUID, p_count INT DEFAULT 3)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alphabet  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codes     TEXT[] := '{}';
  v_code      TEXT;
  v_seg1      TEXT;
  v_seg2      TEXT;
  v_attempts  INT;
  i           INT;
BEGIN
  FOR i IN 1..p_count LOOP
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      IF v_attempts > 100 THEN
        RAISE EXCEPTION 'generate_member_codes: could not generate unique code after 100 attempts';
      END IF;

      -- Build XXXX-XXXX from unambiguous alphabet using pgcrypto random bytes
      SELECT string_agg(substr(v_alphabet, (get_byte(gen_random_bytes(1)) % length(v_alphabet)) + 1, 1), '')
        INTO v_seg1
        FROM generate_series(1, 4);

      SELECT string_agg(substr(v_alphabet, (get_byte(gen_random_bytes(1)) % length(v_alphabet)) + 1, 1), '')
        INTO v_seg2
        FROM generate_series(1, 4);

      v_code := v_seg1 || '-' || v_seg2;

      -- Check uniqueness
      EXIT WHEN NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = v_code);
    END LOOP;

    INSERT INTO invite_codes (code, generated_by) VALUES (v_code, p_user_id);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  RETURN v_codes;
END;
$$;

-- Only service role calls this RPC (triggered server-side after activation)
GRANT EXECUTE ON FUNCTION generate_member_codes(UUID, INT) TO service_role;
