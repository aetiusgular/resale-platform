import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { formatCents } from '@/lib/fees'
import { FOLLOWS_ENABLED, SAVED_SEARCH_ALERTS_ENABLED } from '@/lib/flags'
import { applyBrowseWhere, parseBrowseParams } from '@/lib/browse/filters'
import { getSellerStats } from '@/lib/sellers/stats'
import AppShell from '@/app/components/app-shell'
import SavedClient from './saved-client'

export const metadata: Metadata = {
  title: 'Saved',
  description: 'Your saved items, searches and sellers.',
}

export type SavedListing = {
  id: string
  title: string
  brand: string
  category: string
  department: string
  size: string
  condition_score: number
  price_cents: number
  saves_count: number
  is_price_dropped: boolean
  images: string[]
  created_at: string
  status: string
  seller: { username: string; id_verification_status: string } | null
  original_price_cents: number | null
  price_display: string
  saved_at: string
  price_at_save: number | null
}

export type SavedSearchRow = {
  id: string
  query: Record<string, string>
  created_at: string
  alerts_enabled: boolean
  /** Listings that went live since the search was last viewed ("n NEW"). */
  new_count: number
}

export type FollowedSeller = {
  id: string
  username: string
  verified: boolean
  followed_at: string
  active_listings: number
  rating: number | null
  /** Listings the seller published in the last 7 days ("n NEW THIS WEEK"). */
  new_this_week: number
}

const NEW_SEARCH_CAP = 10

export default async function SavedPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Parallel: profile + saves + saved searches + followed sellers
  const [{ data: profileData }, { data: savesData }, { data: searchData }, { data: followData }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, saved_visited_at').eq('id', user.id).single(),
    supabase
      .from('saves')
      .select(`
        listing_id, created_at,
        listings:listing_id (
          id, title, brand, category, department, size,
          condition_score, price_cents, saves_count, is_price_dropped,
          images, created_at, updated_at, status,
          profiles:seller_id (username, id_verification_status)
        )
      `)
      .order('created_at', { ascending: false }),
    supabase.from('saved_searches').select('id, query, created_at, alerts_enabled, last_seen_at').order('created_at', { ascending: false }),
    supabase
      .from('follows')
      .select('following_id, created_at, profiles:following_id (id, username, id_verification_status)')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const username: string = (profileData?.username as string) ?? ''
  const displayName: string | undefined = (profileData?.display_name as string | null) ?? undefined
  const lastVisit: string | null = (profileData?.saved_visited_at as string | null) ?? null

  // Build listing data from saves join
  const saves = (savesData ?? []).filter((s) => s.listings !== null)

  type JoinedListing = {
    id: string; title: string; brand: string; category: string; department: string
    size: string; condition_score: number; price_cents: number; saves_count: number
    is_price_dropped: boolean; images: string[]; created_at: string; updated_at: string; status: string
    profiles: { username: string; id_verification_status: string } | null
  }

  // Original prices (+ drop timestamps for the "since last visit" note) for dropped listings.
  const droppedIds = saves
    .filter((s) => { const l = s.listings as unknown as JoinedListing; return l.is_price_dropped && l.status === 'active' })
    .map((s) => s.listing_id)

  const origPriceMap = new Map<string, number>()
  const lastDropAt = new Map<string, string>()
  if (droppedIds.length > 0) {
    const { data: history } = await supabase
      .from('price_history')
      .select('listing_id, old_price_cents, changed_at')
      .in('listing_id', droppedIds)
      .order('changed_at', { ascending: true })
    for (const row of history ?? []) {
      if (!origPriceMap.has(row.listing_id)) origPriceMap.set(row.listing_id, row.old_price_cents)
      lastDropAt.set(row.listing_id, row.changed_at)
    }
  }

  const priceAtSaveMap = new Map<string, number>()
  for (const s of saves) {
    const l = s.listings as unknown as JoinedListing
    if (l.is_price_dropped && l.status === 'active') {
      const orig = origPriceMap.get(l.id)
      if (orig && orig > l.price_cents) priceAtSaveMap.set(l.id, orig)
    }
  }

  const savedListings: SavedListing[] = saves.map((s) => {
    const l = s.listings as unknown as JoinedListing
    return {
      id: l.id,
      title: l.title,
      brand: l.brand,
      category: l.category,
      department: l.department,
      size: l.size,
      condition_score: l.condition_score,
      price_cents: l.price_cents,
      saves_count: l.saves_count,
      is_price_dropped: l.is_price_dropped,
      images: Array.isArray(l.images) ? l.images : [],
      created_at: l.created_at,
      status: l.status,
      seller: l.profiles,
      original_price_cents: origPriceMap.get(l.id) ?? null,
      price_display: formatCents(l.price_cents),
      saved_at: s.created_at,
      price_at_save: priceAtSaveMap.get(l.id) ?? null,
    }
  })

  // "2 PRICE DROPS · 1 SOLD SINCE LAST VISIT" — events after the previous visit stamp.
  const since = lastVisit ? Date.parse(lastVisit) : 0
  let dropsSince = 0
  let soldSince = 0
  for (const s of saves) {
    const l = s.listings as unknown as JoinedListing
    if (l.status === 'sold' && Date.parse(l.updated_at) > since) soldSince++
    const d = lastDropAt.get(l.id)
    if (l.status === 'active' && d && Date.parse(d) > since) dropsSince++
  }

  // Saved searches + "n NEW" (listings live since last_seen_at, same WHERE as browse).
  type SearchRowRaw = { id: string; query: unknown; created_at: string; alerts_enabled: boolean | null; last_seen_at: string | null }
  const searchRows = ((searchData ?? []) as SearchRowRaw[]).map((r) => ({
    ...r,
    query: (r.query && typeof r.query === 'object' ? r.query : {}) as Record<string, string>,
  }))
  const newCounts = await Promise.all(searchRows.slice(0, NEW_SEARCH_CAP).map(async (r) => {
    const f = parseBrowseParams(r.query)
    f.sold = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from('listings').select('id', { count: 'exact', head: true })
    q = applyBrowseWhere(q, f).gt('created_at', r.last_seen_at ?? r.created_at)
    const { count } = await q
    return count ?? 0
  }))
  const searches: SavedSearchRow[] = searchRows.map((r, i) => ({
    id: r.id,
    query: r.query,
    created_at: r.created_at,
    alerts_enabled: r.alerts_enabled ?? true,
    new_count: newCounts[i] ?? 0,
  }))

  // Followed sellers: "34 LISTINGS · 4.9 RATING" + "2 NEW THIS WEEK".
  const followRows = (followData ?? []).filter((f) => f.profiles !== null)
  const sellerIds = followRows.map((f) => f.following_id)
  const newThisWeek = new Map<string, number>()
  let statsMap = new Map<string, { sales: number; rating: number | null; ratingCount: number; listings: number }>()
  if (sellerIds.length > 0) {
    // eslint-disable-next-line react-hooks/purity -- server component render; request-time window
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: recent }, stats] = await Promise.all([
      supabase.from('listings').select('seller_id').eq('status', 'active').in('seller_id', sellerIds).gt('created_at', weekAgo),
      getSellerStats(createServiceClientRaw(), sellerIds),
    ])
    for (const row of recent ?? []) newThisWeek.set(row.seller_id, (newThisWeek.get(row.seller_id) ?? 0) + 1)
    statsMap = stats
  }
  const sellers: FollowedSeller[] = followRows.map((f) => {
    const p = f.profiles as unknown as { id: string; username: string; id_verification_status: string }
    const st = statsMap.get(p.id)
    return {
      id: p.id,
      username: p.username,
      verified: p.id_verification_status === 'verified',
      followed_at: f.created_at,
      active_listings: st?.listings ?? 0,
      rating: st?.rating ?? null,
      new_this_week: newThisWeek.get(p.id) ?? 0,
    }
  })

  return (
    <AppShell username={username} displayName={displayName}>
      <Suspense>
        <SavedClient
          listings={savedListings}
          searches={searches}
          sellers={sellers}
          sinceVisit={{ drops: dropsSince, sold: soldSince, hadVisit: !!lastVisit }}
          followsEnabled={FOLLOWS_ENABLED}
          alertsEnabled={SAVED_SEARCH_ALERTS_ENABLED}
        />
      </Suspense>
    </AppShell>
  )
}
