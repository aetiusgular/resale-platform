/**
 * Conversation thread loader — /messages/[id] and GET /api/conversations/[id].
 *
 * Same reads as the page: the conversation row through the caller's client (RLS: participants
 * only), then the listing snapshot, both profiles, buyer stats and the seller trust line through
 * the service client (as the page always did — these rows are not readable cross-party under
 * RLS), then messages + offers through the caller's client and the latest order between the
 * parties for the system lines. Does NOT move the read cursor: the page calls
 * mark_conversation_read itself before loading the inbox rows, the app calls POST …/read.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import type { Offer } from '@/lib/offers'
import { getSellerStats, sellerRatingLine } from '@/lib/sellers/stats'
import { publicImages } from '@/lib/listings/images'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type ThreadMessage = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  redacted: boolean
  created_at: string
}

export type ThreadConversation = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  comments_consent_buyer: boolean
  comments_consent_seller: boolean
}

export type ThreadListing = {
  id: string
  title: string
  brand: string
  size: string
  price_cents: number
  status: string
  images: string[]
}

export type ThreadOrderEvents = {
  id: string
  state: string
  carrier: string | null
  tracking_number: string | null
  transfer_cents: number
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  released_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  disputed_at: string | null
}

export type ThreadBundle = {
  conversation: ThreadConversation
  listing: ThreadListing
  messages: ThreadMessage[]
  offers: Offer[]
  order: ThreadOrderEvents | null
  is_buyer: boolean
  viewer: { id: string; username: string; display_name: string | null }
  other: { id: string; username: string; verified: boolean; meta: string }
}

/** null = the conversation is not visible to this user (RLS) or its listing is gone → 404. */
export async function loadThread(opts: { supabase: Client; user: User; conversationId: string }): Promise<ThreadBundle | null> {
  const { supabase, user, conversationId } = opts

  // Fetch conversation (RLS: participants only)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, comments_consent_buyer, comments_consent_seller')
    .eq('id', conversationId)
    .single()
  if (!conv) return null

  const isBuyer = conv.buyer_id === user.id
  const otherUserId: string = isBuyer ? conv.seller_id : conv.buyer_id

  const service = createServiceClientRaw()

  // Listing details
  const { data: listing } = await service
    .from('listings')
    .select('id, title, brand, size, price_cents, status, images')
    .eq('id', conv.listing_id)
    .single()
  if (!listing) return null

  const [{ data: otherProfile }, { data: currentProfile }, statsMap] = await Promise.all([
    service.from('profiles').select('username, id_verification_status').eq('id', otherUserId).single(),
    service.from('profiles').select('username, display_name').eq('id', user.id).single(),
    getSellerStats(service, [otherUserId]),
  ])

  // Buyer stats (service_role only) for the counterparty record when they are the buyer.
  const { data: buyerStats } = await service
    .from('buyer_stats')
    .select('purchase_count, dispute_count, strike_count, pays_fast')
    .eq('user_id', conv.buyer_id)
    .single()

  const [{ data: messages }, { data: offers }, { data: order }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, redacted, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('offers')
      .select('id, conversation_id, listing_id, from_user, amount_cents, state, expires_at, accepted_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    service
      .from('orders')
      .select('id, state, carrier, tracking_number, transfer_cents, paid_at, shipped_at, delivered_at, released_at, cancelled_at, refunded_at, disputed_at')
      .eq('listing_id', conv.listing_id)
      .eq('buyer_id', conv.buyer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const otherStats = statsMap.get(otherUserId)
  const meta = isBuyer
    ? sellerRatingLine(otherStats)
    : buyerStats
      ? `${buyerStats.purchase_count} PURCHASES · ${buyerStats.dispute_count} DISPUTES${buyerStats.pays_fast ? ' · PAYS FAST' : ''}`
      : sellerRatingLine(otherStats)

  return {
    conversation: conv as ThreadConversation,
    listing: { ...(listing as ThreadListing), images: publicImages(listing.images) },
    messages: (messages ?? []) as ThreadMessage[],
    offers: (offers ?? []) as Offer[],
    order: (order as ThreadOrderEvents | null) ?? null,
    is_buyer: isBuyer,
    viewer: {
      id: user.id,
      username: (currentProfile?.username as string) ?? '',
      display_name: (currentProfile?.display_name as string | null) ?? null,
    },
    other: {
      id: otherUserId,
      username: (otherProfile?.username as string) ?? '—',
      verified: otherProfile?.id_verification_status === 'verified',
      meta,
    },
  }
}
