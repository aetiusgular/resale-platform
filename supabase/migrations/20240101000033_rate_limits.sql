-- Migration: 20240101000033_rate_limits  (security PA — cross-instance rate limiting)
-- The in-memory limiter (lib/rate-limit) counts per serverless instance, so on a multi-
-- instance deploy the effective limit is N × instance_count — abuse paths (phone OTP,
-- checkout, listing velocity, bump) aren't actually bounded. This adds a shared fixed-window
-- counter with an ATOMIC increment RPC so the limit holds across all instances.
--
-- check_rate_limit(key, window_seconds) floors now() to the window, deletes the key's stale
-- buckets (bounding the table to ~1 row per active key), atomically increments the current
-- bucket, and returns the post-increment count + window start (ms). The allowed/remaining/
-- retry decision is computed in the app from that count (pure, unit-tested). SECURITY DEFINER
-- + service_role only; no client access to the table.
-- db-guard: new table (RLS deny-all to clients) + one SECURITY DEFINER function.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies + no grants ⇒ clients cannot read/write. Only the SECURITY DEFINER RPC touches it.

CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_window_seconds INT)
RETURNS TABLE(hit_count INT, window_start_ms BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INT;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    p_window_seconds := 1;
  END IF;

  -- Fixed window: floor now() to the window boundary.
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  -- Bound the table: drop this key's older buckets (keeps ~1 row per active key).
  DELETE FROM rate_limit_hits WHERE key = p_key AND window_start < v_window_start;

  -- Atomic increment of the current bucket.
  INSERT INTO rate_limit_hits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_hits.count + 1
  RETURNING count INTO v_count;

  hit_count       := v_count;
  window_start_ms := (extract(epoch FROM v_window_start) * 1000)::BIGINT;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_rate_limit(TEXT, INT) TO service_role;
