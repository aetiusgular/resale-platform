/**
 * POST /api/webhooks/stripe
 *
 * Receives and verifies Stripe webhook events.
 * Security:
 *   - Signature verified with STRIPE_WEBHOOK_SECRET before any processing.
 *   - Raw body (text) read before JSON parsing.
 *   - All DB mutations via service role.
 *   - NEVER calls getUser() — no auth context here.
 *
 * Idempotency:
 *   - order_events.stripe_event_id UNIQUE constraint is the anchor.
 *   - transition_order() checks for duplicate stripe_event_id and silently returns.
 *   - Replay of same event → 200.
 *
 * Events handled:
 *   payment_intent.succeeded      → create order, listing → sold
 *   payment_intent.payment_failed → release listing lock back to active
 *   account.updated               → update seller payouts_enabled
 *   charge.refunded               → order → refunded
 */
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { constructWebhookEvent } from '@/lib/stripe'
import { createServiceClientRaw } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // ── 1. Read raw body — must be text before signature verification ─────────
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // ── 2. Verify signature ───────────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, signature)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  // ── 3. Route by event type ────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event, service)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event, service)
        break
      case 'account.updated':
        await handleAccountUpdated(event, service)
        break
      case 'charge.refunded':
        await handleChargeRefunded(event, service)
        break
      default:
        break
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[webhook] Error handling ${event.type}:`, msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─────────────────────────────────────────────────────────────────────────────

type ServiceClient = ReturnType<typeof createServiceClientRaw>

async function handlePaymentSucceeded(event: Stripe.Event, service: ServiceClient) {
  const pi = event.data.object as Stripe.PaymentIntent
  const meta = pi.metadata as Record<string, string>

  // Validate required metadata IDs (set server-side at PI creation — immutable)
  for (const key of ['listing_id', 'buyer_id', 'seller_id'] as const) {
    if (!meta[key]) throw new Error(`Missing PI metadata: ${key}`)
  }

  // Use checkout_session row for fee amounts — server-authored and not externally mutable.
  // This prevents fee manipulation via Stripe Dashboard metadata edits.
  const { data: session } = await service
    .from('checkout_sessions')
    .select('item_cents, buyer_fee_cents, seller_fee_cents, shipping_cents, total_cents, buyer_id, seller_id, listing_id')
    .eq('stripe_payment_intent_id', pi.id)
    .single()

  if (!session) {
    // Session already deleted — check if order was already created (idempotent replay)
    const { data: existing } = await service
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()
    if (existing) return // Already processed
    throw new Error(`No checkout_session for PI ${pi.id} and no existing order`)
  }

  const { item_cents, buyer_fee_cents, seller_fee_cents, shipping_cents, total_cents } = session
  const transfer_cents = item_cents - seller_fee_cents

  // Verify PI amount matches session total (tamper check)
  if (pi.amount !== total_cents) {
    throw new Error(`PI amount mismatch: stripe=${pi.amount} session=${total_cents}`)
  }

  // Fetch buyer's shipping address for order snapshot
  const { data: buyerProfile } = await service
    .from('profiles')
    .select('shipping_address')
    .eq('id', session.buyer_id)
    .single()

  // Create the order record
  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      listing_id:               session.listing_id,
      buyer_id:                 session.buyer_id,
      seller_id:                session.seller_id,
      item_cents,
      buyer_fee_cents,
      seller_fee_cents,
      shipping_cents,
      total_cents,
      transfer_cents,
      stripe_payment_intent_id: pi.id,
      shipping_address:         buyerProfile?.shipping_address ?? null,
      state:                    'paid_held',
      paid_at:                  new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orderError) {
    // Unique violation on stripe_payment_intent_id → already processed (idempotent)
    if (orderError.code === '23505') return
    throw new Error(`Order insert failed: ${orderError.message}`)
  }

  // Append initial audit event (stripe_event_id for idempotency on replay)
  await service.from('order_events').insert({
    order_id:        order!.id,
    from_state:      null,
    to_state:        'paid_held',
    source:          'webhook',
    stripe_event_id: event.id,
    payload:         { payment_intent_id: pi.id },
  })

  // Mark listing sold and clean up the checkout lock
  await Promise.all([
    service.from('listings').update({ status: 'sold' }).eq('id', session.listing_id),
    service.from('checkout_sessions').delete().eq('stripe_payment_intent_id', pi.id),
  ])
}

async function handlePaymentFailed(event: Stripe.Event, service: ServiceClient) {
  const pi = event.data.object as Stripe.PaymentIntent
  const listingId = pi.metadata?.listing_id
  if (!listingId) return

  await Promise.all([
    service.from('listings')
      .update({ status: 'active' })
      .eq('id', listingId)
      .eq('status', 'pending_escrow'),
    service.from('checkout_sessions')
      .delete()
      .eq('stripe_payment_intent_id', pi.id),
  ])
}

async function handleAccountUpdated(event: Stripe.Event, service: ServiceClient) {
  const account = event.data.object as Stripe.Account
  await service
    .from('profiles')
    .update({ payouts_enabled: account.payouts_enabled ?? false })
    .eq('stripe_connect_account_id', account.id)
}

async function handleChargeRefunded(event: Stripe.Event, service: ServiceClient) {
  const charge = event.data.object as Stripe.Charge
  const piId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id

  if (!piId) return

  // Find the order by payment intent ID (include listing_id for cleanup)
  const { data: order } = await service
    .from('orders')
    .select('id, state, listing_id')
    .eq('stripe_payment_intent_id', piId)
    .single()

  if (!order) return
  if (order.state === 'refunded' || order.state === 'cancelled') return

  // Transition via RPC (handles idempotency via stripe_event_id uniqueness)
  await service.rpc('transition_order', {
    p_order_id:     order.id,
    p_to_state:     'refunded',
    p_source:       'webhook',
    p_stripe_event: event.id,
    p_payload:      { charge_id: charge.id },
  })

  // Mark listing as removed after refund
  await service
    .from('listings')
    .update({ status: 'removed' })
    .eq('id', order.listing_id)
}
