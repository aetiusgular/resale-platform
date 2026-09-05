/**
 * Order detail loader — /orders/[id] and GET /api/orders/[id].
 *
 * The order row is read through the caller's client (RLS: buyer, seller or admin). The role is
 * decided BEFORE any service-role read, exactly as the page does: the listing snapshot comes
 * through the service client because listings RLS hides sold rows from the buyer, and
 * buyer_stats is service-only. Nothing is read for a viewer who is not a party or an admin.
 * `actions` and the timers are derived here so the app renders the same buttons as the web.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import type { ShipToAddress } from '@/lib/addresses'
import { REVIEWS_ENABLED, SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { autoReleaseAt, disputeDeadlineAt, isDisputeWindowOpen, STATE_LABELS, type OrderState } from '@/lib/orders'
import { publicImages } from '@/lib/listings/images'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export const ORDER_DETAIL_SELECT = `
      id,
      listing_id,
      buyer_id,
      seller_id,
      state,
      item_cents,
      buyer_fee_cents,
      seller_fee_cents,
      shipping_cents,
      total_cents,
      transfer_cents,
      carrier,
      tracking_number,
      shipping_label_url,
      shipping_address,
      ship_to_address,
      stripe_transfer_id,
      paid_at,
      seller_confirmed_at,
      shipped_at,
      delivered_at,
      released_at,
      disputed_at,
      refunded_at,
      cancelled_at,
      created_at
    `

export type OrderRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  state: string
  item_cents: number
  buyer_fee_cents: number
  seller_fee_cents: number
  shipping_cents: number
  total_cents: number
  transfer_cents: number
  carrier: string | null
  tracking_number: string | null
  shipping_label_url: string | null
  /** Buyer address snapshots taken at payment; rendered to the SELLER only (ShipToPanel). */
  shipping_address: ShipToAddress | null
  ship_to_address: ShipToAddress | null
  stripe_transfer_id: string | null
  paid_at: string | null
  seller_confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  released_at: string | null
  disputed_at: string | null
  refunded_at: string | null
  cancelled_at: string | null
  created_at: string
}

export type OrderListingSnap = { title: string; brand: string; size: string; images: string[] }

export type OrderBuyerStats = {
  username: string | null
  purchase_count: number
  dispute_count: number
  member_since: string | null
}

export type OrderDetail = {
  order: OrderRow
  listing: OrderListingSnap
  role: 'buyer' | 'seller' | 'admin'
  viewer: { username: string }
  /** Buyer view: the seller's handle. */
  seller_username: string | null
  /** Seller view only (buyer_stats is service-role). */
  buyer_stats: OrderBuyerStats | null
  review_eligible: boolean
  state_label: string
  /** Buttons the viewer may press right now, mirroring the web order views. */
  actions: { confirm: boolean; ship: boolean; deliver: boolean; dispute: boolean; review: boolean }
  timers: { auto_release_at: string | null; dispute_deadline_at: string | null; dispute_window_open: boolean }
  flags: { reviews: boolean; shipping_labels: boolean }
}

/** null = not found or not visible to this viewer → 404. */
export async function loadOrderDetail(opts: { supabase: Client; user: User; id: string }): Promise<OrderDetail | null> {
  const { supabase, user, id } = opts

  // Fetch order — RLS ensures only buyer or seller (or admin) can see it
  const { data: orderData } = await supabase.from('orders').select(ORDER_DETAIL_SELECT).eq('id', id).single()
  const order = (orderData as unknown as OrderRow | null) ?? null
  if (!order) return null

  // Determine role
  const isBuyer = order.buyer_id === user.id
  const isSeller = order.seller_id === user.id

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()
  const viewerUsername = (viewerProfile?.username as string) ?? ''

  if (!isBuyer && !isSeller) {
    // Admin check — admin can view any order
    if (viewerProfile?.role !== 'admin') return null
  }
  const role: OrderDetail['role'] = isSeller ? 'seller' : isBuyer ? 'buyer' : 'admin'

  // Post-release review prompt (G9). Eligible = a party to a RELEASED order who has
  // not yet reviewed in their direction; the post_review RPC remains authoritative.
  let reviewEligible = false
  if (REVIEWS_ENABLED && order.state === 'released' && (isBuyer || isSeller)) {
    const direction = isBuyer ? 'buyer_to_seller' : 'seller_to_buyer'
    const rsvc = createServiceClientRaw()
    const { data: existingReview } = await rsvc
      .from('reviews')
      .select('id')
      .eq('order_id', order.id)
      .eq('direction', direction)
      .maybeSingle()
    reviewEligible = !existingReview
  }

  // Listing snapshot via service role, NOT the user client: listings RLS only exposes
  // status='active' rows to non-sellers. Safe: the viewer was verified above.
  const service = createServiceClientRaw()
  const { data: listingRow } = await service
    .from('listings')
    .select('title, brand, size, images')
    .eq('id', order.listing_id)
    .single()
  const listing: OrderListingSnap = listingRow
    ? { title: listingRow.title as string, brand: (listingRow.brand as string) ?? '', size: (listingRow.size as string) ?? '', images: publicImages(listingRow.images) }
    : { title: 'Unknown', brand: '', size: '', images: [] }

  let buyerStats: OrderBuyerStats | null = null
  let sellerUsername: string | null = null
  if (isSeller) {
    // buyer_stats is restricted to service_role only (no cross-user dispute-history enumeration).
    const { data: bs } = await service
      .from('buyer_stats')
      .select('username, purchase_count, dispute_count, member_since')
      .eq('user_id', order.buyer_id)
      .single()
    buyerStats = (bs as OrderBuyerStats | null) ?? null
  } else {
    const { data: sellerProfile } = await supabase.from('profiles').select('username').eq('id', order.seller_id).single()
    sellerUsername = (sellerProfile?.username as string) ?? 'seller'
  }

  const state = order.state as OrderState
  const delivered = order.delivered_at ? new Date(order.delivered_at) : null
  const disputeOpen = !!delivered && isDisputeWindowOpen(delivered)
  return {
    order,
    listing,
    role,
    viewer: { username: viewerUsername },
    seller_username: sellerUsername,
    buyer_stats: buyerStats,
    review_eligible: reviewEligible,
    state_label: STATE_LABELS[state] ?? state.toUpperCase(),
    actions: {
      confirm: isSeller && state === 'paid_held',
      ship: isSeller && state === 'seller_confirmed',
      // The web shows CONFIRM DELIVERY once the carrier scan (or the seller) marked it delivered;
      // the deliver route also accepts `shipped`, but the button mirrors the web page.
      deliver: isBuyer && state === 'delivered',
      dispute: isBuyer && state === 'delivered' && disputeOpen,
      review: reviewEligible,
    },
    timers: {
      auto_release_at: delivered && state === 'delivered' ? autoReleaseAt(delivered).toISOString() : null,
      dispute_deadline_at: delivered ? disputeDeadlineAt(delivered).toISOString() : null,
      dispute_window_open: disputeOpen,
    },
    flags: { reviews: REVIEWS_ENABLED, shipping_labels: SHIPPING_LABELS_ENABLED },
  }
}
