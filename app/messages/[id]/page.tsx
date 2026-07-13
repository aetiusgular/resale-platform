/**
 * /messages/[id] — conversation thread.
 * Server component: fetches initial data, renders two-pane layout.
 * ThreadClient handles realtime + interactions.
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import ThreadClient from './thread-client'
import type { Offer } from '@/lib/offers'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ThreadPage({ params }: PageProps) {
  const { id: conversationId } = await params
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

  // Fetch listing details
  const { data: listing } = await service
    .from('listings')
    .select('id, title, price_cents, status, images')
    .eq('id', conv.listing_id)
    .single()

  if (!listing) notFound()

  // Fetch other user's username for header
  const { data: otherProfile } = await service
    .from('profiles')
    .select('username')
    .eq('id', otherUserId)
    .single()

  // Fetch buyer stats (service_role only) for counterparty record
  // Always show the buyer's stats regardless of who is viewing
  const { data: buyerStats } = await service
    .from('buyer_stats')
    .select('purchase_count, dispute_count, strike_count, pays_fast')
    .eq('user_id', conv.buyer_id)
    .single()

  // Fetch initial messages (SSR, then realtime takes over)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, redacted, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // Fetch offers
  const { data: offers } = await supabase
    .from('offers')
    .select('id, conversation_id, listing_id, from_user, amount_cents, state, expires_at, accepted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // Also fetch all conversations for the sidebar (inbox list)
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id, listing_id, buyer_id, seller_id, updated_at,
      listings:listing_id (title, price_cents),
      buyer:buyer_id (username),
      seller:seller_id (username)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ height: '64px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '32px', padding: '0 80px' }}>
        <Link href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', width: '160px' }}>———</Link>
        <div style={{ flex: 1 }} />
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/sell" style={{ display: 'inline-flex', alignItems: 'center', height: '44px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}>Sell</Link>
          <Link href="/messages" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', textDecoration: 'none' }}>Messages</Link>
          <Link href="/settings" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>Settings</Link>
        </nav>
      </header>

      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '360px 1fr', alignItems: 'stretch', minHeight: 'calc(100vh - 64px)' }}>
        {/* LEFT: conversation list sidebar */}
        <div style={{ borderRight: '1px solid var(--color-line)', padding: '24px 24px 24px 0', overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 16px' }}>Messages</h1>

          {conversations?.map((c) => {
            const isActive = c.id === conversationId
            const cIsBuyer = c.buyer_id === user.id
            const other = cIsBuyer
              ? (c.seller as unknown as { username: string } | null)
              : (c.buyer as unknown as { username: string } | null)
            const cListing = c.listings as unknown as { title: string; price_cents: number } | null

            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  border: isActive ? '1px solid var(--color-ink)' : 'none',
                  borderBottom: isActive ? '1px solid var(--color-ink)' : '1px solid var(--color-line)',
                  borderRadius: '2px',
                  padding: isActive ? '12px' : '14px 12px',
                  display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer',
                  marginBottom: isActive ? '0' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink)' }}>@{other?.username ?? '—'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '18px', padding: '0 5px', border: '1px solid var(--color-line)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Bronze</span>
                    <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                      {formatTimeAgo(c.updated_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: isActive ? 'var(--color-ink)' : 'var(--color-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cListing?.title ?? '—'}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* RIGHT: active thread */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Thread header */}
          <div style={{ borderBottom: '1px solid var(--color-line)', padding: '0 24px', height: '48px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link href="/messages" style={{ fontSize: '20px', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', display: 'none' }}>‹</Link>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>
              @{otherProfile?.username ?? '—'}
            </span>
          </div>

          <ThreadClient
            conversationId={conversationId}
            currentUserId={user.id}
            initialMessages={messages ?? []}
            initialOffers={(offers ?? []) as Offer[]}
            conversation={conv}
            listing={listing}
            buyerStats={buyerStats ?? null}
            isBuyer={isBuyer}
          />
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}M`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D`
  return `${Math.floor(days / 7)}W`
}
