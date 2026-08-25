/**
 * /orders — order index: the viewer's purchases and sales, newest first.
 * Both the checkout-success fallback link and the order-page "All orders" header
 * link target this route (it 404'd until now — money-path review finding, closed).
 *
 * Data pattern mirrors /orders/[id]: orders are fetched with the USER client
 * (RLS scopes rows to buyer/seller), then listing snapshots are fetched via the
 * SERVICE role — listings RLS only exposes status='active' to non-sellers, so a
 * buyer's sold/removed listings would come back null and render "UNKNOWN".
 * Safe: the snapshot fetch is keyed strictly off the viewer's own order rows.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import { STATE_LABELS, type OrderState } from '@/lib/orders'
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import PrefetchLink from '@/app/components/prefetch-link'

export const metadata: Metadata = {
  title: 'Orders — Resale Platform',
  description: 'Your purchases and sales.',
}

type OrderRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  state: string
  total_cents: number
  transfer_cents: number
  created_at: string
}

type ListingSnap = { title: string; brand: string; size: string; images: string[] }

const ORDER_COLS = 'id, listing_id, buyer_id, seller_id, state, total_cents, transfer_cents, created_at'

function stateColor(state: string): string {
  if (state === 'disputed') return 'var(--color-alert)'
  if (state === 'refunded' || state === 'cancelled') return 'var(--color-ink-soft)'
  return 'var(--color-ink)'
}

function formatDate(ts: string): string {
  return new Date(ts)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase()
}

function OrderRowLink({
  order,
  listing,
  counterparty,
  role,
}: {
  order: OrderRow
  listing: ListingSnap
  counterparty: string
  role: 'buyer' | 'seller'
}) {
  const image = listing.images?.find(Boolean) ?? null
  const amountCents = role === 'buyer' ? order.total_cents : order.transfer_cents
  const label = STATE_LABELS[order.state as OrderState] ?? order.state.toUpperCase()

  return (
    <PrefetchLink
      href={`/orders/${order.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
        border: '1px solid var(--color-line)', borderRadius: 2,
        textDecoration: 'none', background: 'var(--color-bg)',
      }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- same deferred next/image migration as the order views (needs supabase remotePatterns in next.config first)
        <img
          src={image}
          alt={listing.title}
          style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid var(--color-line)', borderRadius: 2, flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 56, height: 56, border: '1px solid var(--color-line)', borderRadius: 2, flexShrink: 0, background: 'var(--color-bg)' }} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title.toUpperCase()}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.brand.toUpperCase()}{listing.size ? ` · ${listing.size.toUpperCase()}` : ''}
          {' · '}{role === 'buyer' ? 'FROM' : 'TO'} @{counterparty.toUpperCase()}
        </span>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: stateColor(order.state) }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)' }}>
          {formatCents(amountCents)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}>
          {formatDate(order.created_at)}
        </span>
      </div>
    </PrefetchLink>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
      <h2 style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', margin: 0 }}>
        {label}
      </h2>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}>{count}</span>
    </div>
  )
}

function EmptyLine({ text, ctaHref, ctaLabel }: { text: string; ctaHref: string; ctaLabel: string }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', margin: 0, padding: '16px 0' }}>
      {text}{' '}
      <Link href={ctaHref} style={{ color: 'var(--color-ink)', textDecoration: 'underline' }}>
        {ctaLabel}
      </Link>
    </p>
  )
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Own orders, both roles — user client (RLS-scoped), per-role queries so the
  // (buyer_id, created_at) / (seller_id, created_at) access paths stay simple.
  const [{ data: profileData }, { data: buysData }, { data: salesData }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase.from('orders').select(ORDER_COLS).eq('buyer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('orders').select(ORDER_COLS).eq('seller_id', user.id).order('created_at', { ascending: false }),
  ])

  const username: string = (profileData?.username as string) ?? ''
  const purchases = (buysData ?? []) as OrderRow[]
  const sales     = (salesData ?? []) as OrderRow[]

  // Listing snapshots — service role AFTER scoping to the viewer's own orders (see header comment).
  const listingIds = Array.from(new Set([...purchases, ...sales].map((o) => o.listing_id)))
  const listingMap = new Map<string, ListingSnap>()
  if (listingIds.length > 0) {
    const { data: listingRows } = await createServiceClientRaw()
      .from('listings')
      .select('id, title, brand, size, images')
      .in('id', listingIds)
    for (const l of (listingRows ?? []) as Array<ListingSnap & { id: string }>) {
      listingMap.set(l.id, { title: l.title, brand: l.brand, size: l.size, images: Array.isArray(l.images) ? l.images : [] })
    }
  }

  // Counterparty usernames — user client (profiles are readable to authenticated users).
  const counterpartyIds = Array.from(new Set([
    ...purchases.map((o) => o.seller_id),
    ...sales.map((o) => o.buyer_id),
  ]))
  const nameMap = new Map<string, string>()
  if (counterpartyIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', counterpartyIds)
    for (const p of (profileRows ?? []) as Array<{ id: string; username: string }>) {
      nameMap.set(p.id, p.username)
    }
  }

  const fallbackSnap: ListingSnap = { title: 'Unknown', brand: '', size: '', images: [] }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeader username={username} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 32px' }}>
          Orders
        </h1>

        <section style={{ marginBottom: 48 }}>
          <SectionHeader label="Purchases" count={purchases.length} />
          {purchases.length === 0 ? (
            <EmptyLine text="No purchases yet." ctaHref="/browse" ctaLabel="Browse listings" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {purchases.map((o) => (
                <OrderRowLink
                  key={o.id}
                  order={o}
                  listing={listingMap.get(o.listing_id) ?? fallbackSnap}
                  counterparty={nameMap.get(o.seller_id) ?? 'seller'}
                  role="buyer"
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader label="Sales" count={sales.length} />
          {sales.length === 0 ? (
            <EmptyLine text="No sales yet." ctaHref="/sell" ctaLabel="List an item" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sales.map((o) => (
                <OrderRowLink
                  key={o.id}
                  order={o}
                  listing={listingMap.get(o.listing_id) ?? fallbackSnap}
                  counterparty={nameMap.get(o.buyer_id) ?? 'buyer'}
                  role="seller"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <MobileTabBar username={username} />
    </div>
  )
}
