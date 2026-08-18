-- Migration: 20240101000040_money_path_hardening
-- Fixes from the 2026-08-18 money-path code review (findings #3b, #5b, #6, #7).
-- Pairs with the app-side changes in the same commit (webhook lifecycle, transfer
-- idempotency keys, checkout reward restore). db-guard: money state machine + cleanup
-- function + grants; no new tables, no RLS changes beyond two explicit grants.

-- ─── 1. release_expired_checkouts(): self-heal + reward hygiene (#3b, #5b) ─────
-- The old version blindly re-activated every pending_escrow listing with an expired
-- session and deleted the session:
--   (a) if the success webhook crashed between order-insert and listing→sold, the SOLD
--       listing came back as 'active' → double-sell;
--   (b) a session that reserved a buyer reward was deleted without restoring it → every
--       abandoned checkout permanently consumed the buyer's coupon.
-- Now: heal pending_escrow listings that actually have a live order (→ 'sold'), settle
-- reserved rewards for expiring sessions (redeem when their payment produced an order,
-- restore when it didn't), and only unlock listings with no live order.
CREATE OR REPLACE FUNCTION release_expired_checkouts() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- (#3b) Self-heal: a pending_escrow listing with a live order is a crashed success
  -- webhook — the sale happened; finish the listing flip instead of re-listing it.
  UPDATE listings l
     SET status = 'sold'
   WHERE l.status = 'pending_escrow'
     AND EXISTS (
       SELECT 1 FROM orders o
        WHERE o.listing_id = l.id
          AND o.state NOT IN ('cancelled', 'refunded')
     );

  -- (#5b) Reserved reward whose checkout DID pay (order exists) but the webhook crashed
  -- before redeeming: settle it as redeemed against that order.
  UPDATE buyer_rewards br
     SET status = 'redeemed', redeemed_at = now(), order_id = o.id
    FROM checkout_sessions cs
    JOIN orders o ON o.stripe_payment_intent_id = cs.stripe_payment_intent_id
   WHERE cs.expires_at < now()
     AND cs.reward_id = br.id
     AND br.status = 'reserved';

  -- (#5b) Reserved reward whose checkout never paid: give the coupon back.
  UPDATE buyer_rewards br
     SET status = 'active'
   WHERE br.status = 'reserved'
     AND br.id IN (
       SELECT cs.reward_id FROM checkout_sessions cs
        WHERE cs.expires_at < now()
          AND cs.reward_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM orders o
             WHERE o.stripe_payment_intent_id = cs.stripe_payment_intent_id
          )
     );

  -- Release listing locks ONLY for expired sessions with no live order (the live-order
  -- case was healed to 'sold' above; the guard is the belt to that suspender).
  UPDATE listings
     SET status = 'active'
   WHERE status = 'pending_escrow'
     AND id IN (
       SELECT cs.listing_id FROM checkout_sessions cs
        WHERE cs.expires_at < now()
          AND NOT EXISTS (
            SELECT 1 FROM orders o
             WHERE o.listing_id = cs.listing_id
               AND o.state NOT IN ('cancelled', 'refunded')
          )
     );

  -- Clean up expired sessions (a late-succeeding PI with no session is auto-refunded by
  -- the webhook's orphaned-payment self-heal — see app/api/webhooks/stripe/route.ts).
  DELETE FROM checkout_sessions WHERE expires_at < now();
END;
$$;

REVOKE EXECUTE ON FUNCTION release_expired_checkouts FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION release_expired_checkouts TO service_role;
GRANT  EXECUTE ON FUNCTION release_expired_checkouts TO postgres;

-- ─── 2. transition_order(): drop the doomed rejection-audit INSERT (#6) ────────
-- The old "log the rejection" INSERT ran in the same transaction as the RAISE EXCEPTION
-- that immediately follows it, so it ALWAYS rolled back — rejected transitions never left
-- an order_events row. Rather than pretend, remove it; callers already log rejections
-- (console.error on transitionError) and the exception message carries from→to states.
-- Everything else is copied verbatim from migration 0030.
CREATE OR REPLACE FUNCTION transition_order(
  p_order_id      UUID,
  p_to_state      order_state,
  p_source        event_source,
  p_stripe_event  TEXT    DEFAULT NULL,
  p_payload       JSONB   DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current order_state;
  v_allowed order_state[];
  v_transfer_id TEXT;
BEGIN
  -- Idempotency: if this Stripe event was already processed, silently return
  IF p_stripe_event IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM order_events WHERE stripe_event_id = p_stripe_event
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Lock the order row to prevent concurrent transitions
  SELECT state, stripe_transfer_id INTO v_current, v_transfer_id
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found: %', p_order_id;
  END IF;

  -- Legal edge table
  v_allowed := CASE v_current
    WHEN 'paid_held'        THEN ARRAY['seller_confirmed', 'cancelled']::order_state[]
    WHEN 'seller_confirmed' THEN ARRAY['shipped', 'cancelled']::order_state[]
    WHEN 'shipped'          THEN ARRAY['delivered']::order_state[]
    WHEN 'delivered'        THEN ARRAY['released', 'disputed']::order_state[]
    WHEN 'disputed'         THEN ARRAY['released', 'refunded']::order_state[]
    ELSE                         ARRAY[]::order_state[]
  END;

  -- Admin moderation refund: funds still in escrow (pre-release) may be refunded by a
  -- moderator. Excludes 'released' (clawback) and terminal states. Admin-source only.
  IF p_source = 'admin'
     AND p_to_state = 'refunded'
     AND v_current IN ('paid_held', 'seller_confirmed', 'shipped', 'delivered') THEN
    v_allowed := v_allowed || ARRAY['refunded']::order_state[];
  END IF;

  -- Admin clawback on a COLLUSION-HELD released order: state is 'released' but the transfer
  -- was blocked (stripe_transfer_id IS NULL), so the buyer's funds are STILL in escrow and
  -- can be refunded. Guarded on the missing transfer so a real payout is never refunded here
  -- (that reversal is a separate flow). Admin-source only.
  IF p_source = 'admin'
     AND p_to_state = 'refunded'
     AND v_current = 'released'
     AND v_transfer_id IS NULL THEN
    v_allowed := v_allowed || ARRAY['refunded']::order_state[];
  END IF;

  IF NOT (p_to_state = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'illegal transition: % → % for order %',
      v_current, p_to_state, p_order_id;
  END IF;

  -- Update order state + relevant timestamp atomically
  UPDATE orders SET
    state               = p_to_state,
    paid_at             = CASE WHEN p_to_state = 'paid_held'        THEN COALESCE(paid_at, now())             ELSE paid_at             END,
    seller_confirmed_at = CASE WHEN p_to_state = 'seller_confirmed' THEN COALESCE(seller_confirmed_at, now()) ELSE seller_confirmed_at END,
    shipped_at          = CASE WHEN p_to_state = 'shipped'          THEN COALESCE(shipped_at, now())          ELSE shipped_at          END,
    delivered_at        = CASE WHEN p_to_state = 'delivered'        THEN COALESCE(delivered_at, now())        ELSE delivered_at        END,
    released_at         = CASE WHEN p_to_state = 'released'         THEN COALESCE(released_at, now())         ELSE released_at         END,
    disputed_at         = CASE WHEN p_to_state = 'disputed'         THEN COALESCE(disputed_at, now())         ELSE disputed_at         END,
    refunded_at         = CASE WHEN p_to_state = 'refunded'         THEN COALESCE(refunded_at, now())         ELSE refunded_at         END,
    cancelled_at        = CASE WHEN p_to_state = 'cancelled'        THEN COALESCE(cancelled_at, now())        ELSE cancelled_at        END,
    updated_at          = now()
  WHERE id = p_order_id;

  -- Append audit event
  INSERT INTO order_events (order_id, from_state, to_state, source, stripe_event_id, payload)
  VALUES (p_order_id, v_current, p_to_state, p_source, p_stripe_event, p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION transition_order FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION transition_order TO service_role;

-- ─── 3. Make 0034's select-own policies functional (#7) ────────────────────────
-- auto-expose is OFF on this project (grants are explicit). buyer_rewards and boosts got
-- owner-scoped SELECT policies in 0034 but no GRANT, so those policies were dead — any
-- future client-side read would silently 403. RLS still scopes rows to the owner.
GRANT SELECT ON buyer_rewards TO authenticated;
GRANT SELECT ON boosts        TO authenticated;
