-- Migration: 20240101000047_auto_deliver_stale_shipped
-- Money path: escrow can release without a carrier scan (go-live audit 2026-09-05, P0-1).
--
-- Before this migration the ONLY shipped → delivered transition was the EasyPost tracker
-- webhook (app/api/webhooks/easypost), which is dark while SHIPPING_LABELS_ENABLED=false,
-- the launch configuration. Manually shipped orders therefore stopped at `shipped`
-- forever: auto_release_delivered_orders() requires state='delivered' + delivered_at, and
-- the dispute route requires `delivered`. Sellers were never paid and buyers could never
-- dispute.
--
-- The app side of the fix is the buyer's MARK AS RECEIVED action (POST
-- /api/orders/[id]/receive → transition_order shipped → delivered). This migration adds
-- the safety net for buyers who never act: a pg_cron sweep that moves `shipped` orders
-- to `delivered` SHIPPED_AUTO_DELIVER_DAYS (10) after shipped_at. From `delivered` the
-- existing machinery takes over: 3-day auto-release (auto_release_delivered_orders) and
-- the 72h dispute window, so the buyer still gets a dispute opportunity before funds move.
--
-- 10 days is defined in lib/orders.ts as SHIPPED_AUTO_DELIVER_DAYS (the canonical constant,
-- shown in the buyer + seller order views). Change both together.
--
-- Goes through transition_order(), so the row lock, legal-edge check, timestamp stamping
-- and order_events audit row (source 'cron') all apply. No grants change: the function is
-- callable by service_role and postgres (pg_cron) only, like auto_release_delivered_orders.
-- db-guard: run before applying.

-- ─── 1. auto_deliver_stale_shipped_orders() ────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_deliver_stale_shipped_orders() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id, o.shipped_at
    FROM orders o
    WHERE o.state = 'shipped'
      AND o.shipped_at IS NOT NULL
      AND o.shipped_at < now() - INTERVAL '10 days'
  LOOP
    BEGIN
      PERFORM transition_order(
        r.id,
        'delivered',
        'cron',
        NULL,
        jsonb_build_object(
          'reason', 'no_delivery_confirmation',
          'days_in_transit', 10,
          'shipped_at', r.shipped_at
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- One bad row must not stop the sweep; the next hourly run retries it.
      RAISE WARNING 'auto_deliver_stale_shipped_orders: failed to deliver order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_deliver_stale_shipped_orders FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION auto_deliver_stale_shipped_orders TO service_role;
-- pg_cron runs as postgres; explicit grant states the intent (mirrors 0009 §11).
GRANT  EXECUTE ON FUNCTION auto_deliver_stale_shipped_orders TO postgres;

-- ─── 2. Index for the sweep ────────────────────────────────────────────────────
-- Partial index on the exact predicate the sweep uses (state='shipped' rows only).
CREATE INDEX IF NOT EXISTS orders_shipped_at_idx ON orders (shipped_at)
  WHERE state = 'shipped';

-- ─── 3. pg_cron schedule (hourly, same cadence as auto-release) ────────────────
-- Unschedule first: cron.schedule does NOT upsert, so re-running would duplicate the job.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'auto-deliver-stale-shipped-orders';

SELECT cron.schedule(
  'auto-deliver-stale-shipped-orders',
  '30 * * * *',
  'SELECT auto_deliver_stale_shipped_orders()'
);
