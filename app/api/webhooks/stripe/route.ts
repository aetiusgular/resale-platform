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
 *   payment_intent.payment_failed → log only (a failed ATTEMPT is not terminal — see handler)
 *   account.updated               → update seller payouts_enabled
 *   charge.refunded               → order → refunded (FULL refunds only)
 */
import { NextRequest, NextResponse, after } from 'next/server'
import type Stripe from 'stripe'
import stripe, { constructWebhookEvent } from '@/lib/stripe'
import { recsMarkSold, recsMarkRemoved } from '@/lib/recs/sync'
import { redeemReservedReward } from '@/lib/rewards'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED, COLLUSION_HOLD_ENABLED, IDENTITY_LOCKS_ENABLED, IDENTITY_CARD_MAX_OTHER_ACCOUNTS } from '@/lib/flags'
import { notify } from '@/lib/notify'
import { parseIdentityEvent, isIdentityApproval, isIdentityDecline } from '@/lib/idv/stripe-identity'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      case 'identity.verification_session.verified':
      case 'identity.verification_session.canceled':
      case 'identity.verification_session.requires_input':
        await handleIdentityEvent(event, service)
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

// ── INFORM-Act ID verification (Stripe Identity; replaced Persona) ────────────
// The shared Stripe webhook already verified the signature. Record an idempotent audit row
// (UNIQUE(provider,event_id)) and, on a verified session, flip the referenced user's status.
async function handleIdentityEvent(event: Stripe.Event, service: ServiceClient) {
  const ev = parseIdentityEvent(event)
  const { error: logErr } = await service.from('verification_events').insert({
    provider: 'stripe', event_id: ev.eventId, event_name: ev.eventName,
    inquiry_id: ev.sessionId, reference_id: ev.userId, status: ev.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: event as any,
  })
  if (logErr) {
    if (logErr.code === '23505') return // replayed event → no-op
    throw new Error(`verification_events insert failed: ${logErr.message}`)
  }
  if (ev.userId && UUID_RE.test(ev.userId)) {
    if (isIdentityApproval(ev)) {
      await service.from('profiles').update({
        id_verification_status: 'verified', id_verified: true, id_verified_at: new Date().toISOString(),
      }).eq('id', ev.userId)
    } else if (isIdentityDecline(ev)) {
      await service.from('profiles').update({ id_verification_status: 'unverified' }).eq('id', ev.userId)
    }
  }
}

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

    // Code-review fix #1b (self-heal): a charge succeeded but its checkout_session is gone
    // and no order exists — the fee authority is lost, so an order can NEVER be built for
    // this payment (reachable when the success webhook lags past the 30-minute session
    // cleanup). Throwing here made Stripe retry a permanent failure for days while the
    // buyer's money stayed captured. Refund it instead (idempotent per PI) and log loudly.
    console.error(
      `[webhook] ORPHANED PAYMENT ${pi.id}: no checkout_session and no order — auto-refunding`,
    )
    await stripe.refunds.create(
      { payment_intent: pi.id, metadata: { reason: 'orphaned_payment_no_session' } },
      { idempotencyKey: `orphan-refund-${pi.id}` },
    )
    return
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
      ship_to_address:          buyerProfile?.shipping_address ?? null, // G12: complete label recipient
      state:                    'paid_held',
      paid_at:                  new Date().toISOString(),
    })
    .select('id')
    .single()

  // Code-review fix #3a: on the duplicate-order replay path, do NOT return early — a crash
  // between the original order insert and the side-effects below leaves the listing stuck in
  // pending_escrow (which the session cleanup would later flip back to ACTIVE and double-sell).
  // Every statement below is idempotent, so the replay simply repairs whatever is missing.
  let orderId: string
  if (orderError) {
    if (orderError.code !== '23505') throw new Error(`Order insert failed: ${orderError.message}`)
    const { data: existing } = await service
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()
    if (!existing) throw new Error(`Order insert conflicted but no order found for PI ${pi.id}`)
    orderId = existing.id
  } else {
    orderId = order!.id
  }

  // Append initial audit event (stripe_event_id UNIQUE = idempotency anchor; a replay that
  // already wrote it conflicts harmlessly and repairs the crashed-before-audit case instead).
  const { error: auditError } = await service.from('order_events').insert({
    order_id:        orderId,
    from_state:      null,
    to_state:        'paid_held',
    source:          'webhook',
    stripe_event_id: event.id,
    payload:         { payment_intent_id: pi.id },
  })
  if (auditError && auditError.code !== '23505') {
    console.error(`[webhook] order_events audit insert failed for ${orderId}:`, auditError.message)
  }

  // Mark listing sold and clean up the checkout lock
  await Promise.all([
    service.from('listings').update({ status: 'sold' }).eq('id', session.listing_id),
    service.from('checkout_sessions').delete().eq('stripe_payment_intent_id', pi.id),
  ])

  // Recs G1: drop the sold listing from ranking (non-blocking, fail-soft).
  after(() => recsMarkSold(session.listing_id))

  // Fee Model v3: mark the buyer's reserved reward redeemed against this order (fail-soft).
  if (session.reward_id) after(() => redeemReservedReward(service, session.reward_id as string, orderId))

  // Collusion (Branch 4): accumulate the buyer's card fingerprint + billing for the pre-payout check.
  if (COLLUSION_HOLD_ENABLED || IDENTITY_LOCKS_ENABLED) {
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

          // G11 card SOFT lock: shared cards are allowed (households), but a card seen on
          // many distinct accounts is a ban-evasion signal → flag THIS order for moderation
          // (no block). Reuses the order-scoped collusion_flags table.
          if (IDENTITY_LOCKS_ENABLED) {
            const { data: owners } = await service.from('payment_identities')
              .select('user_id').eq('kind', 'card').eq('fingerprint', fp)
            const others = new Set((owners ?? []).map((o) => (o as { user_id: string }).user_id))
            others.delete(session.buyer_id)
            if (others.size >= IDENTITY_CARD_MAX_OTHER_ACCOUNTS) {
              await service.from('collusion_flags').upsert(
                { order_id: orderId, buyer_id: session.buyer_id, seller_id: session.seller_id, reasons: ['card_multi_account'] },
                { onConflict: 'order_id' },
              )
              console.warn(`[identity] card fingerprint on ${others.size + 1} accounts; flagged order ${orderId}`)
            }
          }
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
        orderId: orderId,
      })
    })
  }
}

/**
 * Code-review fix #1: a failed payment ATTEMPT is NOT terminal, so this handler no longer
 * tears the checkout down. Stripe fires `payment_intent.payment_failed` on EVERY declined
 * confirmation, but the buyer is still on the checkout page holding the SAME PaymentIntent
 * and can retry (fix card typo, different card). The old teardown (unlock listing + delete
 * checkout_session + restore reward) made a successful retry arrive at
 * handlePaymentSucceeded with no session and no order — buyer charged, order never created,
 * listing re-sellable to someone else.
 *
 * Lifecycle now: the checkout_session's 30-minute expiry + release_expired_checkouts()
 * (which restores the reserved reward and unlocks the listing — migration 0040) govern
 * abandonment, exactly as they already did for never-attempted checkouts.
 */
async function handlePaymentFailed(event: Stripe.Event, _service: ServiceClient) {
  const pi = event.data.object as Stripe.PaymentIntent
  console.warn(
    `[webhook] payment attempt failed for PI ${pi.id}`,
    pi.last_payment_error?.code ?? pi.last_payment_error?.message ?? 'unknown',
  )
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
  const { data: prof } = await service.from('profiles').select('id').eq('stripe_connect_account_id', account.id).single()
  const uid = (prof as { id?: string } | null)?.id

  // Fetch this account's payout-bank fingerprints once (used for both the G11 hard lock and
  // collusion accumulation). Only meaningful once Stripe reports the account payout-ready.
  const captureOn = COLLUSION_HOLD_ENABLED || IDENTITY_LOCKS_ENABLED
  let banks: Stripe.BankAccount[] = []
  if (uid && account.payouts_enabled && captureOn) {
    try {
      const ext = await stripe.accounts.listExternalAccounts(account.id, { object: 'bank_account', limit: 10 })
      banks = ext.data as Stripe.BankAccount[]
    } catch (e) { console.warn('[identity] bank fingerprint fetch failed (fail-open):', e) }
  }
  const bankFps = banks.map((b) => b.fingerprint).filter((f): f is string => !!f)

  // G11 bank HARD lock: a payout bank may bind to only ONE account. If any of this account's
  // banks already belongs to a DIFFERENT user, block payouts here (welcome-farming / ban
  // evasion). The partial unique index is the DB backstop; this is the app-level enforcement.
  let bankBlocked = false
  if (IDENTITY_LOCKS_ENABLED && uid && bankFps.length) {
    try {
      const { data: owners } = await service.from('payment_identities')
        .select('user_id').eq('kind', 'bank').in('fingerprint', bankFps)
      bankBlocked = (owners ?? []).some((o) => (o as { user_id: string }).user_id !== uid)
    } catch (e) { console.warn('[identity] bank lock check failed (fail-open):', e) }
  }

  // payouts_enabled = Stripe's value AND not bank-blocked (unchanged when locks are off).
  await service
    .from('profiles')
    .update({ payouts_enabled: (account.payouts_enabled ?? false) && !bankBlocked })
    .eq('stripe_connect_account_id', account.id)
  if (bankBlocked) {
    console.warn(`[identity] payouts blocked for ${account.id}: payout bank already bound to another account`)
  }

  // Accumulate this account's bank fingerprint(s) for future checks (bind to this user),
  // unless blocked (the bank belongs to someone else — never rebind it). Idempotent per user;
  // the partial unique index rejects a cross-account rebind at the DB as a final guard.
  if (uid && captureOn && !bankBlocked) {
    for (const bank of banks) {
      if (!bank.fingerprint) continue
      try {
        await service.from('payment_identities').upsert({
          user_id: uid, kind: 'bank', fingerprint: bank.fingerprint,
          billing_name: bank.account_holder_name ?? null, billing_zip: null,
        }, { onConflict: 'user_id,kind,fingerprint' })
      } catch (e) { console.warn('[identity] bank capture failed:', e) }
    }
  }
}

async function handleChargeRefunded(event: Stripe.Event, service: ServiceClient) {
  const charge = event.data.object as Stripe.Charge
  const piId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id

  if (!piId) return

  // Code-review fix #4: `charge.refunded` fires for PARTIAL refunds too (e.g. a courtesy
  // shipping refund issued from the Stripe dashboard). Only a FULL refund voids the order —
  // a partial one must not kill the sale or remove the listing. `charge.refunded` is only
  // true when fully refunded; the amount check is the belt to that suspender.
  if (!charge.refunded || charge.amount_refunded < charge.amount) {
    console.warn(
      `[webhook] partial refund on ${piId} (${charge.amount_refunded}/${charge.amount}) — order state unchanged`,
    )
    return
  }

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
