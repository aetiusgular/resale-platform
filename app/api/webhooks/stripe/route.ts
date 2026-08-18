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
import { NextRequest, NextResponse, after } from 'next/server'
import type Stripe from 'stripe'
import stripe, { constructWebhookEvent } from '@/lib/stripe'
import { recsMarkSold, recsMarkRemoved } from '@/lib/recs/sync'
import { redeemReservedReward, restoreReward } from '@/lib/rewards'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED, COLLUSION_HOLD_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

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

  // Boost purchases (Fee Model v3) are standalone platform charges (no order/escrow).
  if (meta.kind === 'boost') {
    await handleBoostSucceeded(pi, service)
    return
  }

  // Validate required metadata IDs (set server-side at PI creation — immutable)
  for (const key of ['listing_id', 'buyer_id', 'seller_id'] as const) {
    if (!meta[key]) throw new Error(`Missing PI metadata: ${key}`)
  }

  // Use checkout_session row for fee amounts — server-authored and not externally mutable.
  // This prevents fee manipulation via Stripe Dashboard metadata edits.
  const { data: session } = await service
    .from('checkout_sessions')
    .select('item_cents, buyer_fee_cents, seller_fee_cents, shipping_cents, total_cents, discount_cents, reward_id, buyer_fee_bps, seller_fee_bps, buyer_id, seller_id, listing_id')
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

  const { item_cents, buyer_fee_cents, seller_fee_cents, shipping_cents, total_cents, discount_cents, buyer_fee_bps, seller_fee_bps } = session
  const transfer_cents = item_cents - seller_fee_cents
  // G11: fee-model label snapshot. Money fields come from the validated session above;
  // fee_mode is descriptive and rides in immutable PI metadata set at checkout.
  const fee_mode = meta.fee_mode === 'welcome' ? 'welcome' : 'tier'

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
      buyer_fee_bps,
      seller_fee_bps,
      shipping_cents,
      total_cents,
      transfer_cents,
      discount_cents,
      fee_mode,
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

  // Recs G1: drop the sold listing from ranking (non-blocking, fail-soft).
  after(() => recsMarkSold(session.listing_id))

  // Fee Model v3: mark the buyer's reserved reward redeemed against this order (fail-soft).
  if (session.reward_id) after(() => redeemReservedReward(service, session.reward_id as string, order!.id))

  // Collusion (Branch 4): accumulate the buyer's card fingerprint + billing for the pre-payout check.
  if (COLLUSION_HOLD_ENABLED) {
    after(async () => {
      try {
        const pmId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id
        if (!pmId) return
        const pm = await stripe.paymentMethods.retrieve(pmId)
        const fp = pm.card?.fingerprint
        if (fp) {
          await service.from('payment_identities').upsert({
            user_id: session.buyer_id, kind: 'card', fingerprint: fp,
            billing_name: pm.billing_details?.name ?? null,
            billing_zip: pm.billing_details?.address?.postal_code ?? null,
          }, { onConflict: 'user_id,kind,fingerprint' })
        }
      } catch (e) { console.warn('[collusion] card capture failed:', e) }
    })
  }

  if (NOTIFICATIONS_ENABLED) {
    after(async () => {
      const { data: l } = await service.from('listings').select('title').eq('id', session.listing_id).single()
      await notify(service, session.seller_id, 'sale', {
        itemTitle: (l as { title?: string } | null)?.title,
        amountCents: item_cents,
        orderId: order!.id,
      })
    })
  }
}

async function handlePaymentFailed(event: Stripe.Event, service: ServiceClient) {
  const pi = event.data.object as Stripe.PaymentIntent
  const listingId = pi.metadata?.listing_id
  if (!listingId) return

  // Restore any reserved buyer reward so a failed payment doesn't consume it.
  const { data: sess } = await service.from('checkout_sessions').select('reward_id').eq('stripe_payment_intent_id', pi.id).single()
  const rid = (sess as { reward_id?: string | null } | null)?.reward_id
  if (rid) await restoreReward(service, rid)

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

// Fee Model v3: activate a paid boost when its standalone charge succeeds. Idempotent.
async function handleBoostSucceeded(pi: Stripe.PaymentIntent, service: ServiceClient) {
  const { data: boost } = await service
    .from('boosts')
    .select('id, listing_id, duration_days, status')
    .eq('stripe_payment_intent_id', pi.id)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = boost as any
  if (!b || b.status !== 'pending') return
  const now = Date.now()
  const endsIso = new Date(now + b.duration_days * 86_400_000).toISOString()
  const { data: activated } = await service
    .from('boosts')
    .update({ status: 'active', starts_at: new Date(now).toISOString(), ends_at: endsIso })
    .eq('id', b.id)
    .eq('status', 'pending')
    .select('id')
    .single()
  if (activated) {
    await service.from('listings').update({ boosted_until: endsIso }).eq('id', b.listing_id)
  }
}

async function handleAccountUpdated(event: Stripe.Event, service: ServiceClient) {
  const account = event.data.object as Stripe.Account
  await service
    .from('profiles')
    .update({ payouts_enabled: account.payouts_enabled ?? false })
    .eq('stripe_connect_account_id', account.id)

  // Collusion (Branch 4): accumulate the seller's payout-bank fingerprint(s).
  if (COLLUSION_HOLD_ENABLED && account.payouts_enabled) {
    try {
      const { data: prof } = await service.from('profiles').select('id').eq('stripe_connect_account_id', account.id).single()
      const uid = (prof as { id?: string } | null)?.id
      if (uid) {
        const ext = await stripe.accounts.listExternalAccounts(account.id, { object: 'bank_account', limit: 10 })
        for (const ba of ext.data) {
          const bank = ba as Stripe.BankAccount
          if (bank.fingerprint) {
            await service.from('payment_identities').upsert({
              user_id: uid, kind: 'bank', fingerprint: bank.fingerprint,
              billing_name: bank.account_holder_name ?? null, billing_zip: null,
            }, { onConflict: 'user_id,kind,fingerprint' })
          }
        }
      }
    } catch (e) { console.warn('[collusion] bank capture failed:', e) }
  }
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

  // Recs G1: drop the refunded listing from the index (non-blocking, fail-soft).
  after(() => recsMarkRemoved(order.listing_id))
}
