-- Migration: 20240101000003_fix_rpc_security
-- Security fixes from code-reviewer pass on B1 diff:
-- 1. claim_invite_code: remove p_user_id param; use auth.uid() internally so
--    callers cannot forge another user's identity.
-- 2. generate_member_codes: lock the profile row (SELECT FOR UPDATE) at the
--    start to serialize concurrent calls and prevent double-generation.
-- db-guard reviewed: 2026-07-12

-- ─── Fix 1: claim_invite_code — use auth.uid(), drop p_user_id param ─────────
CREATE OR REPLACE FUNCTION claim_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row  invite_codes%ROWTYPE;
  v_normalized TEXT;
  v_user_id   UUID;
BEGIN
  v_user_id    := auth.uid();
  v_normalized := upper(trim(p_code));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

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

  -- Prevent self-claiming
  IF v_code_row.generated_by = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot claim your own code');
  END IF;

  -- Atomic claim
  UPDATE invite_codes
     SET status     = 'claimed',
         used_by    = v_user_id,
         claimed_at = now()
   WHERE code = v_normalized;

  -- Stamp the profile with invited_by
  UPDATE profiles
     SET invited_by = v_code_row.generated_by
   WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'error', null);
END;
$$;

-- Revoke old signature (2-arg) if it exists, grant new 1-arg signature
REVOKE ALL ON FUNCTION claim_invite_code(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_invite_code(TEXT) TO authenticated;

-- ─── Fix 2: generate_member_codes — lock profile row to serialize calls ───────
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
  -- Lock the profile row to serialize concurrent calls for the same user.
  -- If two requests race, the second will block until the first commits,
  -- then see the existing codes and return early.
  PERFORM id FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Idempotency: if codes already exist, return them
  SELECT array_agg(code ORDER BY created_at)
    INTO v_codes
    FROM invite_codes
   WHERE generated_by = p_user_id;

  IF array_length(v_codes, 1) IS NOT NULL THEN
    RETURN v_codes;
  END IF;

  v_codes := '{}';

  FOR i IN 1..p_count LOOP
    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      IF v_attempts > 100 THEN
        RAISE EXCEPTION 'generate_member_codes: could not generate unique code after 100 attempts';
      END IF;

      SELECT string_agg(substr(v_alphabet, (get_byte(gen_random_bytes(1)) % length(v_alphabet)) + 1, 1), '')
        INTO v_seg1
        FROM generate_series(1, 4);

      SELECT string_agg(substr(v_alphabet, (get_byte(gen_random_bytes(1)) % length(v_alphabet)) + 1, 1), '')
        INTO v_seg2
        FROM generate_series(1, 4);

      v_code := v_seg1 || '-' || v_seg2;

      EXIT WHEN NOT EXISTS (SELECT 1 FROM invite_codes WHERE code = v_code);
    END LOOP;

    INSERT INTO invite_codes (code, generated_by) VALUES (v_code, p_user_id);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  RETURN v_codes;
END;
$$;

-- Grant unchanged — service_role only
GRANT EXECUTE ON FUNCTION generate_member_codes(UUID, INT) TO service_role;
