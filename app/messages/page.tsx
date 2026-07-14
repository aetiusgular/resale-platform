/**
 * /messages — conversation inbox (desktop two-pane shell).
 * If ?listing=<id> is present, auto-creates or finds the conversation and redirects.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import SiteHeader from '@/app/components/site-header'

interface PageProps {
  searchParams: Promise<{ listing?: string }>
}

export default async function MessagesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profileRow } = await supabase
    .from('profiles').select('username').eq('id', user.id).single()
  const username: string = (profileRow?.username as string) ?? ''

  const { listing: listingId } = await searchParams

  // Auto-create conversation if ?listing= present
  if (listingId) {
    const service = createServiceClientRaw()
    const { data: listingRow } = await service
      .from('listings')
      .select('id, seller_id, status')
      .eq('id', listingId)
      .single()

    if (listingRow && listingRow.seller_id !== user.id &&
        listingRow.status !== 'sold' && listingRow.status !== 'removed') {
      // Find or create conversation
      const { data: existing } = await service
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .eq('seller_id', listingRow.seller_id)
        .maybeSingle()

      if (existing) {
        redirect(`/messages/${existing.id}`)
      } else {
        const { data: created } = await service
          .from('conversations')
          .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listingRow.seller_id })
          .select('id')
          .single()
        if (created) redirect(`/messages/${created.id}`)
      }
    }
    // Fall through to inbox if listing not found / user is seller
  }

  // Fetch conversations for inbox
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id, listing_id, buyer_id, seller_id, updated_at,
      listings:listing_id (title, brand, price_cents, images, status),
      buyer:buyer_id (username),
      seller:seller_id (username)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <SiteHeader username={username} />

      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '360px 1fr', alignItems: 'stretch', minHeight: 'calc(100vh - 64px)' }}>
        {/* LEFT: conversation list */}
        <div style={{ borderRight: '1px solid var(--color-line)', padding: '24px 24px 24px 0' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 16px' }}>Messages</h1>

          {(!conversations || conversations.length === 0) && (
            <p style={{ fontSize: '13px', color: 'var(--color-ink-soft)' }}>No conversations yet.</p>
          )}

          {conversations?.map((conv) => {
            const listing = conv.listings as unknown as { title: string; brand: string; price_cents: number; images: string[]; status: string } | null
            const isBuyer = conv.buyer_id === user.id
            const other = isBuyer
              ? (conv.seller as unknown as { username: string } | null)
              : (conv.buyer as unknown as { username: string } | null)
            const timeAgo = formatTimeAgo(conv.updated_at)

            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink)' }}>@{other?.username ?? '—'}</span>
                    {/* Tier badge stub — B7 */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: '18px', padding: '0 5px', border: '1px solid var(--color-line)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Bronze</span>
                    <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>{timeAgo}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing?.title ?? '—'} · {listing ? formatCents(listing.price_cents) : ''}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* RIGHT: empty state on /messages */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-soft)', fontSize: '14px' }}>
          Select a conversation
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
