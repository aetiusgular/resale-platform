-- Migration: 20240101000030_escrow_refund  (Branch 4 / moderation console)
-- Adds ONE admin edge to transition_order(): 'released' → 'refunded' when the payout is
-- still in ESCROW (stripe_transfer_id IS NULL). This is the collusion-clawback case: a
-- collusion hold leaves an order 'released' with the transfer BLOCKED, so the buyer's funds
-- are still in the platform balance and can be safely refunded. It NEVER fires once a
-- transfer exists (that is a true clawback/reversal, out of scope) and only for
-- p_source = 'admin'. Everything else is copied verbatim from migration 0024.
-- db-guard + code-reviewer: money state machine change.

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
    -- Log the rejection (stripe_event_id NULL to avoid unique conflict)
    INSERT INTO order_events (order_id, from_state, to_state, source, payload)
    VALUES (p_order_id, v_current, p_to_state, p_source,
            COALESCE(p_payload, '{}'::jsonb) || '{"rejected":true}'::jsonb);
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
