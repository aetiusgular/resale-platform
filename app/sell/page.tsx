/**
 * /sell — the seller's catalog (reference CatalogView): stats line "n ACTIVE ·
 * n DRAFTS · n SOLD · TIER 2 — 9.0% FEE", ACTIVE / DRAFTS / SOLD tabs, cards
 * with "214 VIEWS · 18 SAVES · 1 OFFER · LISTED 4D", EDIT · BUMP ↑ · OFFER $x,
 * drafts "3 OF 6 PHOTOS · NO PRICE SET" + CONTINUE →, sold "SOLD AUG 12 · PAID
 * OUT $373" + RELIST / VIEW ORDER. NEW LISTING + → /sell/new.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents, FEE_TIERS, WELCOME_SALES } from '@/lib/fees'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { fmtRate } from '@/lib/tier-dashboard'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED } from '@/lib/flags'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import SellCatalog, { type SellerListing } from './sell-catalog'

export const metadata: Metadata = { title: 'Sell' }

export default async function SellPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const service = createServiceClientRaw()
  const [{ data: profile }, { data: rows }, sellerBps] = await Promise.all([
    supabase.from('profiles').select('username, display_name, lifetime_sales_count').eq('id', user.id).single(),
    supabase
      .from('listings')
      .select('id, title, brand, size, price_cents, status, images, possession_photo_url, created_at, updated_at, saves_count, view_count, boosted_until, bumped_at, rejection_reason, is_price_dropped')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    resolveEffectiveBps(service, user.id, 'seller'),
  ])

  const username: string = (profile?.username as string) ?? ''
  const salesCount: number = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeLeft = Math.max(0, WELCOME_SALES - salesCount)

  const ids = (rows ?? []).map((r) => r.id)
  const soldIds = (rows ?? []).filter((r) => r.status === 'sold').map((r) => r.id)

  // Open buyer offers + the payout for sold items (service role: orders are
  // party-scoped under RLS, and these are the seller's own listings).
  const offerCounts = new Map<string, { count: number; top: number }>()
  const payoutMap = new Map<string, { transfer_cents: number; released_at: string | null; order_id: string; created_at: string }>()
  if (ids.length > 0) {
    const [{ data: offers }, { data: orders }] = await Promise.all([
      supabase.from('offers').select('listing_id, amount_cents, from_user, state').in('listing_id', ids).eq('state', 'open').neq('from_user', user.id),
      soldIds.length > 0
        ? service.from('orders').select('id, listing_id, transfer_cents, released_at, created_at').in('listing_id', soldIds).eq('seller_id', user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    for (const o of offers ?? []) {
      const cur = offerCounts.get(o.listing_id) ?? { count: 0, top: 0 }
      offerCounts.set(o.listing_id, { count: cur.count + 1, top: Math.max(cur.top, o.amount_cents) })
    }
    for (const o of (orders ?? []) as Array<{ id: string; listing_id: string; transfer_cents: number; released_at: string | null; created_at: string }>) {
      if (!payoutMap.has(o.listing_id)) payoutMap.set(o.listing_id, { transfer_cents: o.transfer_cents, released_at: o.released_at, order_id: o.id, created_at: o.created_at })
    }
  }

  // eslint-disable-next-line react-hooks/purity -- server component render; freshness at request time
  const now = Date.now()
  const listings: SellerListing[] = (rows ?? []).map((r) => {
    const images: string[] = Array.isArray(r.images) ? r.images.filter(Boolean) : []
    const photoCount = images.length + (r.possession_photo_url && !images.includes(r.possession_photo_url) ? 1 : 0)
    const payout = payoutMap.get(r.id)
    return {
      id: r.id,
      title: r.title ?? '',
      brand: r.brand ?? '',
      size: r.size ?? '',
      price_cents: r.price_cents ?? null,
      price_display: r.price_cents ? formatCents(r.price_cents) : '$ —',
      status: r.status,
      image: images[0] ?? null,
      photo_count: Math.min(6, photoCount),
      created_at: r.created_at,
      updated_at: r.updated_at,
      saves_count: r.saves_count ?? 0,
      view_count: r.view_count ?? 0,
      boosted: !!r.boosted_until && new Date(r.boosted_until).getTime() > now,
      boosted_until: r.boosted_until,
      bumped_at: r.bumped_at,
      rejection_reason: r.rejection_reason,
      open_offers: offerCounts.get(r.id)?.count ?? 0,
      top_offer_display: offerCounts.get(r.id) ? formatCents(offerCounts.get(r.id)!.top) : null,
      sold_at: payout?.released_at ?? payout?.created_at ?? r.updated_at,
      payout_display: payout ? formatCents(payout.transfer_cents) : null,
      order_id: payout?.order_id ?? null,
    }
  })

  const tierIdx = FEE_TIERS.findIndex((t) => t.bps === sellerBps)
  const tierNumber = tierIdx >= 0 ? FEE_TIERS.length - tierIdx : 1
  const feeLine = welcomeLeft > 0
    ? `WELCOME RAMP — 0% FEE · ${welcomeLeft} OF ${WELCOME_SALES} FREE SALES LEFT`
    : `TIER ${tierNumber} — ${fmtRate(sellerBps)} FEE`

  return (
    <AppShell username={username} displayName={(profile?.display_name as string | null) ?? undefined}>
      <SellCatalog
        listings={listings}
        feeLine={feeLine}
        bumpEnabled={BUMP_ENABLED}
        boostEnabled={BOOSTED_POSTS_ENABLED}
        newListing={<PrefetchLink href="/sell/new" className="btn-primary btn-primary--inline" data-testid="new-listing">NEW LISTING +</PrefetchLink>}
      />
    </AppShell>
  )
}
