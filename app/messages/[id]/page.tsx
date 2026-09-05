/**
 * /messages/[id] — conversation thread (design 1A).
 * Desktop: sidebar inbox + thread. Mobile: the thread fills the screen with a
 * back control to the inbox (.msgs--thread). Opening the thread moves the
 * caller's read cursor (mark_conversation_read) before the inbox rows load so
 * the badges reflect it in the same render.
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import ThreadClient from './thread-client'
import type { Offer } from '@/lib/offers'
import { getSellerStats, sellerRatingLine } from '@/lib/sellers/stats'
import AppShell from '@/app/components/app-shell'
import InboxList from '../inbox-list'
import { loadInbox } from '../inbox'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ counter?: string }>
}

export default async function ThreadPage({ params, searchParams }: PageProps) {
  const [{ id: conversationId }, { counter: counterOfferId }] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Fetch conversation (RLS: participants only)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, comments_consent_buyer, comments_consent_seller')
    .eq('id', conversationId)
    .single()

  if (!conv) notFound()

  const isBuyer = conv.buyer_id === user.id
  const otherUserId = isBuyer ? conv.seller_id : conv.buyer_id

  const service = createServiceClientRaw()

  // Read cursor first so the inbox rows + header badge see this thread as read.
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })

  // Listing details
  const { data: listing } = await service
    .from('listings')
    .select('id, title, brand, size, price_cents, status, images')
    .eq('id', conv.listing_id)
    .single()

  if (!listing) notFound()

  const [{ data: otherProfile }, { data: currentProfile }, statsMap] = await Promise.all([
    service.from('profiles').select('username, id_verification_status').eq('id', otherUserId).single(),
    service.from('profiles').select('username, display_name').eq('id', user.id).single(),
    getSellerStats(service, [otherUserId]),
  ])
  const currentUsername: string = (currentProfile?.username as string) ?? ''

  // Buyer stats (service_role only) for the counterparty record when they are the buyer.
  const { data: buyerStats } = await service
    .from('buyer_stats')
    .select('purchase_count, dispute_count, strike_count, pays_fast')
    .eq('user_id', conv.buyer_id)
    .single()

  // Initial messages (SSR, then realtime takes over) + offers + order events + inbox rows
  const [{ data: messages }, { data: offers }, { data: order }, rows] = await Promise.all([
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
    loadInbox(supabase, user.id),
  ])

  const otherStats = statsMap.get(otherUserId)
  const meta = isBuyer
    ? sellerRatingLine(otherStats)
    : buyerStats
      ? `${buyerStats.purchase_count} PURCHASES · ${buyerStats.dispute_count} DISPUTES${buyerStats.pays_fast ? ' · PAYS FAST' : ''}`
      : sellerRatingLine(otherStats)

  return (
    <AppShell username={currentUsername} displayName={(currentProfile?.display_name as string | null) ?? undefined} footer={false}>
      <div className="msgs msgs--thread">
        <InboxList rows={rows} activeId={conversationId} />
        <ThreadClient
          conversationId={conversationId}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          initialOffers={(offers ?? []) as Offer[]}
          conversation={conv}
          listing={listing}
          order={order ?? null}
          isBuyer={isBuyer}
          counterOfferId={counterOfferId ?? null}
          other={{
            username: (otherProfile?.username as string) ?? '—',
            verified: otherProfile?.id_verification_status === 'verified',
            meta,
          }}
        />
      </div>
    </AppShell>
  )
}
