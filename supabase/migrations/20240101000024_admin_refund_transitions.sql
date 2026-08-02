-- Migration: 20240101000024_admin_refund_transitions
-- Extends transition_order() so an ADMIN (moderation refund) may refund an order whose
-- funds are still in ESCROW (pre-release), in addition to the existing dispute path.
-- NEVER allows 'released' → 'refunded' (funds already transferred to the seller — that
-- is a clawback and needs its own flow) and never loosens the normal buyer/seller/webhook
-- flow: the new edges fire only when p_source = 'admin'. Amounts are never mutated here;
-- the caller issues the Stripe refund. Everything else is copied verbatim from 0009.
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
  SELECT state INTO v_current
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
