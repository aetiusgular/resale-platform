/**
 * POST /api/checkout
 *
 * Creates a Stripe PaymentIntent and locks the listing to pending_escrow.
 * Fee amounts are ALWAYS server-computed — never trust client totals.
 * The checkout_sessions row acts as the atomic lock: UNIQUE on listing_id
 * prevents two buyers from simultaneously locking the same listing.
 *
 * Request body: { listingId: string, offerId?: string, shippingAddress?: object }
 *   offerId: if provided, price is sourced from the accepted offer (server-verified).
 *            Offer must be state='accepted' and belong to this buyer+listing.
 *            Offer-based checkout: item + 2% buyer fee, no shipping line.
 * Response: { clientSecret: string, orderSummary: {...} }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { orderAmountsAt } from '@/lib/fees'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { checkRateLimit } from '@/lib/rate-limit'
import { isBanned } from '@/lib/auth/ban'

export async function POST(request: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Ban guard (G6): suspended accounts cannot check out ──────────────────
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  // ── Rate limit: 10 checkout attempts per user per hour ───────────────────
  const rl = await checkRateLimit(`checkout:${user.id}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // ── 2. Parse and minimally validate body ─────────────────────────────────
  let body: { listingId?: unknown; offerId?: unknown; shippingAddress?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { listingId, offerId, shippingAddress } = body
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'listingId required' }, { status: 400 })
  }
  // Basic UUID format check — prevents sending garbage to DB
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)) {
    return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 })
  }
  if (offerId !== undefined && (typeof offerId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerId as string))) {
    return NextResponse.json({ error: 'Invalid offerId' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  // ── 3. Fetch listing (must be active or pending_escrow if offer-based) ───
  const { data: listing } = await service
    .from('listings')
    .select('id, title, brand, price_cents, seller_id, status, images')
    .eq('id', listingId)
    .single()

  if (!listing || listing.status === 'sold' || listing.status === 'removed') {
    return NextResponse.json({ error: 'Listing not available for purchase' }, { status: 409 })
  }
  // All checkouts require an active listing — offer-based included.
  // If listing is pending_escrow it means another buyer's checkout is in progress.
  if (listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing is already being purchased by another buyer' }, { status: 409 })
  }

  // Prevent buyer from purchasing their own listing
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: 'Cannot purchase your own listing' }, { status: 422 })
  }

  // ── 4. Check seller payouts_enabled ──────────────────────────────────────
  const { data: seller } = await service
    .from('profiles')
    .select('payouts_enabled, stripe_connect_account_id')
    .eq('id', listing.seller_id)
    .single()

  if (!seller?.payouts_enabled || !seller?.stripe_connect_account_id) {
    return NextResponse.json(
      { error: 'Seller cannot accept payments yet' },
      { status: 422 },
    )
  }

  // ── 5. Server-compute fees (NEVER trust client) ───────────────────────────
  // Offer-based checkout: verify accepted offer + use its amount (no shipping).
  // Regular checkout: use listing price + standard shipping.
  let priceCents = listing.price_cents
  let verifiedOfferId: string | undefined

  if (offerId) {
    const { data: offerRow } = await service
      .from('offers')
      .select('id, listing_id, conversation_id, amount_cents, state, accepted_at')
      .eq('id', offerId as string)
      .single()

    if (!offerRow || offerRow.listing_id !== listingId) {
      return NextResponse.json({ error: 'Offer not found for this listing' }, { status: 404 })
    }
    if (offerRow.state !== 'accepted') {
      return NextResponse.json({ error: 'Offer is not in accepted state' }, { status: 422 })
    }
    // Verify the buyer is the conversation buyer
    const { data: conv } = await service
      .from('conversations')
      .select('buyer_id')
      .eq('id', offerRow.conversation_id)
      .single()

    if (!conv || conv.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Offer does not belong to this buyer' }, { status: 422 })
    }
    // Verify payment window hasn't lapsed (24h from accepted_at)
    if (offerRow.accepted_at) {
      const deadline = new Date(offerRow.accepted_at).getTime() + 24 * 60 * 60 * 1000
      if (Date.now() > deadline) {
        return NextResponse.json({ error: 'Payment window has expired' }, { status: 422 })
      }
    }

    priceCents = offerRow.amount_cents
    verifiedOfferId = offerRow.id
  }

  // Tiered fees: each side rated on its own trailing-365d activity, resolved
  // server-side and snapshotted below (never trust the client, never recompute).
  const [buyerBps, sellerBps] = await Promise.all([
    resolveEffectiveBps(service, user.id, 'buyer'),
    resolveEffectiveBps(service, listing.seller_id, 'seller'),
  ])
  const amounts = orderAmountsAt(priceCents, buyerBps, sellerBps, offerId ? 0 : undefined)

  // ── 6. Atomically lock listing + create checkout_session ─────────────────
  // UPDATE ... WHERE status = 'active' is atomic — if two requests race, only
  // one succeeds because the row is locked by the first UPDATE.
  const { data: lockedListing, error: lockError } = await service
    .from('listings')
    .update({ status: 'pending_escrow' })
    .eq('id', listingId)
    .eq('status', 'active')  // optimistic lock: fails if already locked
    .select('id')
    .single()

  if (lockError || !lockedListing) {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 })
  }

  // ── 7. Create Stripe PaymentIntent ────────────────────────────────────────
  // All fee amounts stored in metadata for webhook reconstruction.
  // Metadata values must be strings.
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount:   amounts.total_cents,
      currency: 'usd',
      // Separate charges & transfers: platform charges buyer, transfer to seller on release
      transfer_data: undefined, // Transfer created manually on delivery confirmation
      metadata: {
        listing_id:       listingId,
        buyer_id:         user.id,
        seller_id:        listing.seller_id,
        item_cents:       String(amounts.item_cents),
        buyer_fee_cents:  String(amounts.buyer_fee_cents),
        seller_fee_cents: String(amounts.seller_fee_cents),
        shipping_cents:   String(amounts.shipping_cents),
        total_cents:      String(amounts.total_cents),
        transfer_cents:   String(amounts.transfer_cents),
        ...(verifiedOfferId ? { offer_id: verifiedOfferId } : {}),
        // Shipping address stored for fulfillment reference (no name/email — no PII)
        ...(shippingAddress && typeof shippingAddress === 'object' ? {
          shipping_city:    String((shippingAddress as Record<string,unknown>).city ?? '').slice(0, 100),
          shipping_state:   String((shippingAddress as Record<string,unknown>).state ?? '').slice(0, 50),
          shipping_zip:     String((shippingAddress as Record<string,unknown>).zip ?? '').slice(0, 20),
          shipping_country: String((shippingAddress as Record<string,unknown>).country ?? 'US').slice(0, 10),
        } : {}),
      },
      description: `${listing.title} — ${listing.brand}`,
    })
  } catch (stripeError) {
    // Roll back listing lock if Stripe fails
    await service
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId)
    console.error('[checkout] Stripe error:', stripeError)
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  // ── 8. Store checkout_session (fee snapshot + expiry) ─────────────────────
  const { error: sessionError } = await service
    .from('checkout_sessions')
    .insert({
      stripe_payment_intent_id: paymentIntent.id,
      listing_id:               listingId,
      buyer_id:                 user.id,
      seller_id:                listing.seller_id,
      item_cents:               amounts.item_cents,
      buyer_fee_cents:          amounts.buyer_fee_cents,
      seller_fee_cents:         amounts.seller_fee_cents,
      shipping_cents:           amounts.shipping_cents,
      total_cents:              amounts.total_cents,
      buyer_fee_bps:            buyerBps,
      seller_fee_bps:           sellerBps,
    })

  if (sessionError) {
    // Unique violation: another checkout_session already exists for this listing
    // (race condition after our lock — should be rare but handle it)
    await stripe.paymentIntents.cancel(paymentIntent.id)
    await service.from('listings').update({ status: 'active' }).eq('id', listingId)
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 })
  }

  // ── 9. Return client secret ───────────────────────────────────────────────
  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    orderSummary: {
      listing_id:       listingId,
      title:            listing.title,
      brand:            listing.brand,
      image:            (listing.images as string[])?.[0] ?? null,
      item_cents:       amounts.item_cents,
      buyer_fee_cents:  amounts.buyer_fee_cents,
      buyer_fee_bps:    buyerBps,
      shipping_cents:   amounts.shipping_cents,
      total_cents:      amounts.total_cents,
    },
  })
}
