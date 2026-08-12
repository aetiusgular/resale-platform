-- Migration: 20240101000037_fix_recommend_moderator_count
-- G10 review follow-up. recommend_moderator() permits `is_moderator OR role='admin'` to
-- vouch, but the original promotion COUNT (migration 0036) tallied only is_moderator=true.
-- Consequence: an admin who is not also flagged is_moderator could record a vouch that
-- never counted toward the threshold of 3 — the "Recommend" button appeared to no-op for
-- admins. This aligns the count predicate with the recommend permission (admins count too).
-- Only the count query changes; all other logic is identical to 0036.
CREATE OR REPLACE FUNCTION recommend_moderator(p_nominee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  UUID;
  v_cprof   profiles%ROWTYPE;
  v_nominee profiles%ROWTYPE;
  v_count   INT;
  v_promoted BOOLEAN := false;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cprof FROM profiles WHERE id = v_caller;
  IF NOT FOUND OR v_cprof.banned THEN
    RAISE EXCEPTION 'not_a_moderator' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (v_cprof.is_moderator OR v_cprof.role = 'admin') THEN
    RAISE EXCEPTION 'not_a_moderator' USING ERRCODE = 'P0001';
  END IF;

  IF p_nominee_id = v_caller THEN
    RAISE EXCEPTION 'cannot_recommend_self' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_nominee FROM profiles WHERE id = p_nominee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nominee_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.banned THEN
    RAISE EXCEPTION 'nominee_banned' USING ERRCODE = 'P0001';
  END IF;
  IF v_nominee.id_verification_status <> 'verified' THEN
    RAISE EXCEPTION 'nominee_not_verified' USING ERRCODE = 'P0001';
  END IF;

  IF v_nominee.is_moderator THEN
    INSERT INTO moderator_recommendations (nominee_id, recommender_id)
    VALUES (p_nominee_id, v_caller)
    ON CONFLICT (nominee_id, recommender_id) DO NOTHING;
    RETURN jsonb_build_object('distinctCount', 0, 'promoted', false, 'alreadyModerator', true);
  END IF;

  INSERT INTO moderator_recommendations (nominee_id, recommender_id)
  VALUES (p_nominee_id, v_caller)
  ON CONFLICT (nominee_id, recommender_id) DO NOTHING;

  -- Count DISTINCT recommenders who are STILL valid (non-banned) recommenders — the same
  -- predicate as who is allowed to recommend: a moderator OR an admin.
  SELECT COUNT(*) INTO v_count
  FROM moderator_recommendations r
  JOIN profiles p ON p.id = r.recommender_id
  WHERE r.nominee_id = p_nominee_id
    AND (p.is_moderator = true OR p.role = 'admin')
    AND p.banned = false;

  IF v_count >= 3 THEN
    UPDATE profiles
      SET is_moderator = true, moderator_since = now()
      WHERE id = p_nominee_id AND is_moderator = false;
    v_promoted := true;
  END IF;

  RETURN jsonb_build_object('distinctCount', v_count, 'promoted', v_promoted, 'alreadyModerator', false);
END;
$$;

GRANT EXECUTE ON FUNCTION recommend_moderator(UUID) TO authenticated;
