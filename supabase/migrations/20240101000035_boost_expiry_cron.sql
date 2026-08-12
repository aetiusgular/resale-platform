-- Fee Model v3 — boost expiry hygiene.
-- Pure data mutation (no external calls), so it runs as an in-DB pg_cron job like
-- auto_release_delivered_orders / release_expired_checkouts — SELF-SCHEDULING, no
-- external scheduler needed. Also callable on demand via /api/cron/boost-expiry
-- (that route just invokes this same function, so there is one source of truth).

CREATE OR REPLACE FUNCTION expire_boosts() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retire boosts whose window has ended.
  UPDATE boosts
  SET status = 'expired'
  WHERE status = 'active'
    AND ends_at < now();

  -- Clear the denormalized listing flag once its boost window has passed, so it
  -- stops floating in browse (applyBoostOrder only lifts boosted_until > now).
  UPDATE listings
  SET boosted_until = NULL
  WHERE boosted_until IS NOT NULL
    AND boosted_until < now();
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_boosts FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION expire_boosts TO service_role;
-- pg_cron runs as the postgres superuser; explicit grant makes the intent clear.
GRANT  EXECUTE ON FUNCTION expire_boosts TO postgres;

-- pg_cron: hourly. Unschedule first for idempotency (cron.schedule does not upsert).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-boosts';
SELECT cron.schedule('expire-boosts', '0 * * * *', 'SELECT expire_boosts()');
