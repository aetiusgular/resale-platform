/**
 * Checkout preview loader — /checkout/[listingId] and GET /api/checkout/preview.
 *
 * Read-only: nothing is locked and no PaymentIntent is created here. POST /api/checkout does that
 * and its `orderSummary` (server-computed, offer-aware) is the source of truth the client shows
 * after it. `state` mirrors the page's three branches: `ok`, `unavailable` (not active),
 * `own` (the viewer's listing).
 *
 * The saved shipping address is read through the service client scoped to the caller's own id:
 * `profiles.shipping_address` is service-role only since migration 0044 (the page's cookie-client
 * select could not return it).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents, orderAmountsAt } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { quoteShipping, regionsForOrigin, REGION_LABELS, type IntlShipping, cleanIntlShipping } from '@/lib/shipping-regions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type CheckoutPreview = {
  state: 'ok' | 'unavailable' | 'own'
  viewer: { username: string }
  listing: { id: string; title: string; brand: string; size: string; image: string | null; status: string }
  /** Present only when state === 'ok'. Priced for the saved address (US when none). */
  preview: { item_cents: number; shipping_cents: number; total_cents: number; total_display: string } | null
  /** Where the listing ships from and which lanes it offers (drives the checkout copy). */
  shipping: { ships_from: string; us_domestic: boolean; regions: Array<{ key: string; label: string; cents: number }> }
  saved_address: Record<string, string> | null
  /** Validated `?offerId=` echo (null when absent/malformed). */
  offer_id: string | null
}

const UUID_RE = /^[0-9a-f-]{36}$/i

/** null = listing not visible to this buyer → 404. */
export async function loadCheckoutPreview(opts: { supabase: Client; user: User; listingId: string; offerId?: string | null }): Promise<CheckoutPreview | null> {
  const { supabase, user, listingId } = opts
  const service = createServiceClientRaw()

  // Fetch the listing (visible if active OR pending_escrow for the current buyer)
  const [{ data: listing }, { data: profile }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, brand, category, size, price_cents, shipping_cents, images, seller_id, status, ships_from, intl_shipping')
      .eq('id', listingId)
      .single(),
    service.from('profiles').select('username, shipping_address').eq('id', user.id).single(),
  ])
  if (!listing) return null

  const username = (profile?.username as string) ?? ''
  const image = ((listing.images as string[] | null) ?? []).find(Boolean) ?? null
  const base = {
    viewer: { username },
    listing: { id: listing.id as string, title: listing.title as string, brand: listing.brand as string, size: (listing.size as string) ?? '', image, status: listing.status as string },
    saved_address: (profile?.shipping_address as Record<string, string> | null) ?? null,
    offer_id: typeof opts.offerId === 'string' && UUID_RE.test(opts.offerId) ? opts.offerId : null,
    shipping: shippingLanes(listing.ships_from as string | null, listing.intl_shipping as IntlShipping | null),
  }

  if (listing.status !== 'active') return { ...base, state: 'unavailable', preview: null }
  if (listing.seller_id === user.id) return { ...base, state: 'own', preview: null }

  // Fee Model v3: buyers pay no platform fee; only the seller rate is tiered.
  const sellerBps = await resolveEffectiveBps(service, listing.seller_id, 'seller')
  // Preview only — the API's orderSummary (server-computed, offer-aware) replaces this on mount.
  // Priced for the saved address; a lane the seller doesn't offer previews as $0 shipping
  // and the API's 422 explains it.
  const quote = quoteShipping({
    origin: (listing.ships_from as string | null) ?? 'US',
    destination: (base.saved_address?.country as string | undefined) ?? 'US',
    domesticCents: listing.shipping_cents ?? floorShippingCents(listing.category),
    intl: (listing.intl_shipping as IntlShipping | null) ?? {},
    isOffer: !!base.offer_id,
  })
  const preview = orderAmountsAt(listing.price_cents, sellerBps, quote.ok ? quote.cents : 0)
  return {
    ...base,
    state: 'ok',
    preview: { item_cents: preview.item_cents, shipping_cents: preview.shipping_cents, total_cents: preview.total_cents, total_display: formatCents(preview.total_cents) },
  }
}

/** The lanes a listing offers, for the checkout page's copy. */
function shippingLanes(shipsFrom: string | null, intl: IntlShipping | null): CheckoutPreview['shipping'] {
  const origin = shipsFrom ?? 'US'
  const rates = cleanIntlShipping(intl ?? {}, origin)
  return {
    ships_from: origin,
    us_domestic: origin === 'US',
    regions: regionsForOrigin(origin).filter((k) => rates[k] !== undefined).map((k) => ({ key: k, label: REGION_LABELS[k], cents: rates[k] as number })),
  }
}
