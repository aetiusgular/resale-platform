/**
 * POST /api/checkout
 *
 * Creates a Stripe PaymentIntent and locks the listing to pending_escrow.
 * Fee amounts are ALWAYS server-computed — never trust client totals.
 * The checkout_sessions row acts as the atomic lock: UNIQUE on listing_id
 * prevents two buyers from simultaneously locking the same listing.
 *
 * Request body: { listingId: string, offerId?: string, address?: AddressInput }
 *   offerId: if provided, price is sourced from the accepted offer (server-verified).
 *            Offer must be state='accepted' and belong to this buyer+listing.
 *            Offer-based checkout: no domestic shipping line (international lanes still
 *            pay the seller's region rate — the seller buys that label).
 *   address: the destination to price shipping for. Omitted → the buyer's saved default
 *            address (profiles.shipping_address), else US.
 * Response: { clientSecret: string, orderSummary: {...} }
 *
 * PATCH /api/checkout { listingId, address } — the buyer changed the destination before
 * paying: re-prices the shipping line for it (lib/shipping-regions), then updates the
 * checkout_session and the PaymentIntent amount together. Only while the PaymentIntent has
 * not been confirmed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { orderAmountsAt, resolveFeeMode, welcomeSellerFeeCents, transferCentsFor, buyerChargeCents, STRIPE_PCT_BPS } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { quoteShipping, REGION_LABELS, type IntlShipping, type ShippingQuote } from '@/lib/shipping-regions'
import { cleanAddress, type AddressInput } from '@/lib/addresses'
import { countryName } from '@/lib/countries'
import { reserveBestReward, restoreReward } from '@/lib/rewards'
import { BUYER_REWARDS_ENABLED } from '@/lib/flags'
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
  let body: { listingId?: unknown; offerId?: unknown; address?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { listingId, offerId } = body
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
  let typedAddress: AddressInput | null = null
  if (body.address !== undefined && body.address !== null) {
    const cleaned = cleanAddress(body.address)
    if ('error' in cleaned) return NextResponse.json({ error: cleaned.error, code: 'bad_address' }, { status: 400 })
    typedAddress = cleaned.address
  }

  const service = createServiceClientRaw()

  // ── 3. Fetch listing (must be active or pending_escrow if offer-based) ───
  const { data: listing } = await service
    .from('listings')
    .select('id, title, brand, category, price_cents, shipping_cents, seller_id, status, images, ships_from, intl_shipping')
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
    .select('payouts_enabled, stripe_connect_account_id, lifetime_sales_count')
    .eq('id', listing.seller_id)
    .single()

  if (!seller?.payouts_enabled || !seller?.stripe_connect_account_id) {
    return NextResponse.json(
      { error: 'Seller cannot accept payments yet' },
      { status: 422 },
    )
  }

  // A listing that ships from outside the US prices every lane with the seller's own rates, so
  // its origin must be real: it has to match the country of the seller's Stripe payout account
  // (Stripe verifies that one). Stops a US seller posing as foreign to move money out of the
  // fee base into "shipping".
  const shipsFrom = (listing.ships_from as string | null) ?? 'US'
  if (shipsFrom !== 'US') {
    try {
      const acct = await stripe.accounts.retrieve(seller.stripe_connect_account_id as string)
      if ((acct.country ?? '').toUpperCase() !== shipsFrom) {
        return NextResponse.json({ error: 'This listing can’t be bought right now.', code: 'origin_mismatch' }, { status: 422 })
      }
    } catch (e) {
      console.error('[checkout] connect account lookup failed:', e)
      return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
    }
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

  // Fee Model v3: buyers pay NO platform fee — only the seller rate is tiered
  // (resolved server-side from the seller's own trailing-365d activity, then
  // snapshotted below; never trust the client, never recompute a historical fee).
  const sellerBps = await resolveEffectiveBps(service, listing.seller_id, 'seller')
  const buyerBps = 0
  // G11 welcome ramp: a seller's first 10 non-cancelled sales are 0% commission (seller
  // covers Stripe processing only); sale 11+ uses the tier rate above. Snapshotted per order.
  const feeMode = resolveFeeMode(seller?.lifetime_sales_count ?? 0)
  // Shipping lane (lib/shipping-regions). US → US is system-derived and stored on the listing
  // (sellers cannot set it); offer checkouts carry no domestic shipping line (unchanged).
  // Every other lane is the seller's region rate and the seller buys that label.
  // Destination: the address the client sent, else the buyer's saved default, else US.
  let destination: Record<string, unknown> | null = typedAddress as Record<string, unknown> | null
  if (!destination) {
    const { data: buyerProfile } = await service.from('profiles').select('shipping_address').eq('id', user.id).single()
    destination = (buyerProfile?.shipping_address as Record<string, unknown> | null) ?? null
  }
  const quote = quoteShipping({
    origin: shipsFrom,
    destination: (destination?.country as string | undefined) ?? 'US',
    domesticCents: listing.shipping_cents ?? floorShippingCents(listing.category),
    intl: (listing.intl_shipping as IntlShipping | null) ?? {},
    isOffer: !!offerId,
  })
  if (!quote.ok) {
    return NextResponse.json(
      { error: shippingUnavailableMessage(quote, (destination?.country as string | undefined) ?? 'US'), code: 'shipping_unavailable' },
      { status: 422 },
    )
  }
  const shippingCents = quote.cents
  // Fee Model v3: apply the buyer's best milestone reward (platform-funded, fail-soft).
  // Reserved now, redeemed on payment success, restored if this checkout rolls back.
  const reward = BUYER_REWARDS_ENABLED ? await reserveBestReward(service, user.id, priceCents) : null
  let amounts = orderAmountsAt(priceCents, sellerBps, shippingCents, reward?.discountCents ?? 0)
  if (feeMode === 'welcome') {
    // 0% platform commission: the seller fee is the Stripe processing cost only (2.9% +
    // $0.30 on the item — sellers never pay shipping), capped at item. Buyer total unchanged.
    const welcomeFee = welcomeSellerFeeCents(priceCents)
    amounts = { ...amounts, seller_fee_cents: welcomeFee }
  }
  // International (seller-label) lanes pay the shipping line out with the item.
  amounts = {
    ...amounts,
    transfer_cents: transferCentsFor({
      itemCents: amounts.item_cents, sellerFeeCents: amounts.seller_fee_cents,
      shippingCents: amounts.shipping_cents, labelMode: quote.labelMode,
    }),
  }
  // Snapshot the seller "rate" for display/audit: processing estimate in welcome mode,
  // resolved tier bps otherwise. (Money fields are the amounts above, validated at webhook.)
  const sellerFeeBpsSnapshot = feeMode === 'welcome' ? STRIPE_PCT_BPS : sellerBps

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
    // Code-review fix #5a: this failure branch reserved the buyer's reward above but
    // previously returned without restoring it, leaking the coupon into 'reserved' forever.
    if (reward) await restoreReward(service, reward.rewardId)
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
        fee_mode:         feeMode,
        item_cents:       String(amounts.item_cents),
        buyer_fee_cents:  String(amounts.buyer_fee_cents),
        seller_fee_cents: String(amounts.seller_fee_cents),
        shipping_cents:   String(amounts.shipping_cents),
        total_cents:      String(amounts.total_cents),
        transfer_cents:   String(amounts.transfer_cents),
        discount_cents:   String(amounts.discount_cents),
        label_mode:       quote.labelMode,
        shipping_region:  quote.region,
        ...(verifiedOfferId ? { offer_id: verifiedOfferId } : {}),
        // No address here (PII): the priced destination is snapshotted on checkout_sessions
        // below, and the webhook copies it onto the order.
      },
      description: `${listing.title} — ${listing.brand}`,
    })
  } catch (stripeError) {
    // Roll back listing lock if Stripe fails
    await service
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId)
    if (reward) await restoreReward(service, reward.rewardId)
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
      discount_cents:           amounts.discount_cents,
      reward_id:                reward?.rewardId ?? null,
      buyer_fee_bps:            buyerBps,
      seller_fee_bps:           sellerFeeBpsSnapshot,
      label_mode:               quote.labelMode,
      shipping_region:          quote.region,
      ship_to_address:          destination,
    })

  if (sessionError) {
    // Unique violation: another checkout_session already exists for this listing
    // (race condition after our lock — should be rare but handle it)
    await stripe.paymentIntents.cancel(paymentIntent.id)
    await service.from('listings').update({ status: 'active' }).eq('id', listingId)
    if (reward) await restoreReward(service, reward.rewardId)
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
      discount_cents:   amounts.discount_cents,
      total_cents:      amounts.total_cents,
      ...shippingSummary(quote),
    },
  })
}

/** Buyer-facing reason a destination can't be priced. */
function shippingUnavailableMessage(quote: Extract<ShippingQuote, { ok: false }>, country: string): string {
  return quote.reason === 'restricted'
    ? `We can’t ship to ${countryName(country)}.`
    : `This seller doesn’t ship to ${countryName(country)}. Choose another address or browse other listings.`
}

/** Lane fields for the client's order summary. */
function shippingSummary(quote: Extract<ShippingQuote, { ok: true }>) {
  return {
    label_mode:      quote.labelMode,
    shipping_region: quote.region,
    shipping_label:  quote.region === 'domestic' ? 'US' : REGION_LABELS[quote.region].toUpperCase(),
  }
}

// ─── PATCH: re-price shipping for a new destination before paying ──────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }
  const rl = await checkRateLimit(`checkout-ship:${user.id}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  let body: { listingId?: unknown; address?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const listingId = typeof body.listingId === 'string' ? body.listingId : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)) {
    return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 })
  }
  const cleaned = cleanAddress(body.address)
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error, code: 'bad_address' }, { status: 400 })
  const address = cleaned.address

  const service = createServiceClientRaw()
  // The buyer's own open checkout for this listing (UNIQUE on listing_id).
  const { data: session } = await service
    .from('checkout_sessions')
    .select('stripe_payment_intent_id, buyer_id, item_cents, buyer_fee_cents, seller_fee_cents, shipping_cents, total_cents, discount_cents, label_mode, shipping_region')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Checkout expired. Reload the page to start again.', code: 'no_session' }, { status: 404 })

  const { data: listing } = await service
    .from('listings')
    .select('category, shipping_cents, ships_from, intl_shipping')
    .eq('id', listingId)
    .single()
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  let pi
  try {
    pi = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id as string)
  } catch (e) {
    console.error('[checkout:patch] retrieve failed:', e)
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }
  if (pi.status !== 'requires_payment_method' && pi.status !== 'requires_confirmation') {
    return NextResponse.json({ error: 'This payment is already being processed.', code: 'pi_locked' }, { status: 409 })
  }

  const quote = quoteShipping({
    origin: (listing.ships_from as string | null) ?? 'US',
    destination: address.country,
    domesticCents: listing.shipping_cents ?? floorShippingCents(listing.category),
    intl: (listing.intl_shipping as IntlShipping | null) ?? {},
    isOffer: !!pi.metadata?.offer_id,
  })
  if (!quote.ok) {
    return NextResponse.json({ error: shippingUnavailableMessage(quote, address.country), code: 'shipping_unavailable' }, { status: 422 })
  }

  const item = session.item_cents as number
  const sellerFee = session.seller_fee_cents as number
  // The reward discount never grows here; it only shrinks if the new gross is smaller.
  const { totalCents: total, discountCents: discount } = buyerChargeCents({
    itemCents: item, buyerFeeCents: session.buyer_fee_cents as number,
    shippingCents: quote.cents, discountCents: session.discount_cents as number,
  })
  const transfer = transferCentsFor({ itemCents: item, sellerFeeCents: sellerFee, shippingCents: quote.cents, labelMode: quote.labelMode })
  const prevMetadata = {
    shipping_cents:  String(session.shipping_cents),
    total_cents:     String(session.total_cents),
    discount_cents:  String(session.discount_cents),
    transfer_cents:  pi.metadata?.transfer_cents ?? '',
    label_mode:      String(session.label_mode ?? 'platform'),
    shipping_region: String(session.shipping_region ?? 'domestic'),
  }

  // Stripe first: an amount update is refused once the card is confirmed, so a PATCH racing a
  // payment fails here and never touches the session the webhook reads. The amount is always
  // sent (even unchanged) for exactly that reason.
  try {
    await stripe.paymentIntents.update(pi.id, {
      amount: total,
      metadata: {
        shipping_cents:  String(quote.cents),
        total_cents:     String(total),
        discount_cents:  String(discount),
        transfer_cents:  String(transfer),
        label_mode:      quote.labelMode,
        shipping_region: quote.region,
      },
    })
  } catch (e) {
    console.error('[checkout:patch] PI update refused:', e)
    return NextResponse.json({ error: 'This payment is already being processed.', code: 'pi_locked' }, { status: 409 })
  }

  // Then the session (the webhook's fee authority + ship-to snapshot), guarded on exactly the
  // row we priced from so a concurrent PATCH can't interleave. On a lost race, put the
  // PaymentIntent back to that row's amount so the two never disagree.
  const { data: updated, error: upErr } = await service
    .from('checkout_sessions')
    .update({
      shipping_cents: quote.cents, total_cents: total, discount_cents: discount,
      label_mode: quote.labelMode, shipping_region: quote.region, ship_to_address: address,
    })
    .eq('stripe_payment_intent_id', pi.id)
    .eq('total_cents', session.total_cents as number)
    .eq('shipping_cents', session.shipping_cents as number)
    .eq('label_mode', (session.label_mode as string | null) ?? 'platform')
    .select('stripe_payment_intent_id')
  if (upErr || !updated || updated.length === 0) {
    try {
      await stripe.paymentIntents.update(pi.id, { amount: session.total_cents as number, metadata: prevMetadata })
    } catch (e) {
      console.error(`[checkout:patch] could not restore PI ${pi.id} after a lost race:`, e)
    }
    return NextResponse.json({ error: 'Checkout changed. Reload the page and try again.', code: 'conflict' }, { status: 409 })
  }

  return NextResponse.json({
    orderSummary: {
      listing_id:      listingId,
      item_cents:      item,
      buyer_fee_cents: session.buyer_fee_cents as number,
      shipping_cents:  quote.cents,
      discount_cents:  discount,
      total_cents:     total,
      ...shippingSummary(quote),
    },
  })
}
