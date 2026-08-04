import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCents } from '@/lib/fees'
import BrowseClient from './browse-client'
import { AUTH_BADGE_ENABLED, RECS_ENABLED, RECS_TELEMETRY_ENABLED } from '@/lib/flags'
import { getFeed } from '@/lib/recs/client'
import { applyFeedOrder } from '@/lib/recs/rank'

export const metadata: Metadata = {
  title: 'Browse — Resale Platform',
  description: 'Browse curated secondhand fashion listings.',
}

const PAGE_SIZE = 24

export type BrowseListing = {
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
  seller: { username: string; id_verification_status: string } | null
  authentication_status: string
  // Derived on server
  original_price_cents: number | null
  price_display: string
}

export type FilterCounts = {
  departments: Record<string, number>
  categories: Record<string, number>
}

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const q        = params.q?.trim() ?? ''
  const dept     = params.dept ?? ''
  const cat      = params.cat ?? ''
  const size     = params.size ?? ''
  const brand    = params.brand ?? ''
  const minPrice = params.min_price ? Math.round(parseFloat(params.min_price) * 100) : null
  const maxPrice = params.max_price ? Math.round(parseFloat(params.max_price) * 100) : null
  const condMin  = params.cond ? parseInt(params.cond, 10) : null
  const verified = params.verified === '1'
  const authenticated = params.authenticated === '1'
  const dropped  = params.dropped === '1'
  const sort     = params.sort ?? 'newest'
  const offset   = params.offset ? parseInt(params.offset, 10) : 0

  // ── Personalized ordering (feed→browse): fail-soft, flag-gated ─────────────
  // Only the UNFILTERED first page of pure discovery is reranked. Any search,
  // filter, explicit price/condition, or deeper page keeps the deterministic
  // default order. The feed fetch runs concurrently with the listing queries.
  const isDiscoveryView =
    !q && !dept && !cat && !size && !brand &&
    minPrice === null && maxPrice === null && condMin === null &&
    !verified && !authenticated && !dropped &&
    (sort === 'newest' || sort === 'relevance')
  const recsEligible = RECS_ENABLED && isDiscoveryView && offset === 0
  const feedPromise = recsEligible ? getFeed({ userId: user.id }) : Promise.resolve(null)

  // ── Build listing query ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('listings')
    .select(`
      id, title, brand, category, department, size,
      condition_score, price_cents, saves_count, is_price_dropped, authentication_status,
      images, created_at,
      profiles:seller_id (username, id_verification_status)
    `)
    .eq('status', 'active')

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' })
  }
  if (dept)   query = query.eq('department', dept)
  if (cat)    query = query.eq('category', cat)
  if (size)   query = query.eq('size', size)
  if (brand)  query = query.ilike('brand', `%${brand}%`)
  if (minPrice !== null) query = query.gte('price_cents', minPrice)
  if (maxPrice !== null) query = query.lte('price_cents', maxPrice)
  if (condMin !== null)  query = query.gte('condition_score', condMin)
  if (verified) query = query.eq('profiles.id_verification_status', 'verified')
  if (dropped)  query = query.eq('is_price_dropped', true)
  if (authenticated) query = query.eq('authentication_status', 'authenticated')

  switch (sort) {
    case 'price_asc':  query = query.order('price_cents', { ascending: true }).order('id'); break
    case 'price_desc': query = query.order('price_cents', { ascending: false }).order('id'); break
    case 'most_saved': query = query.order('saves_count', { ascending: false }).order('id'); break
    case 'relevance':
      if (q) { query = query.order('id'); break } // ts_rank applied automatically
      // fallthrough to newest if no query
      /* falls through */
    default:           query = query.order('created_at', { ascending: false }).order('id')
  }

  query = query.range(offset, offset + PAGE_SIZE)

  // ── Build count query ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  if (q)     countQuery = countQuery.textSearch('search_vector', q, { type: 'websearch', config: 'english' })
  if (dept)  countQuery = countQuery.eq('department', dept)
  if (cat)   countQuery = countQuery.eq('category', cat)
  if (size)  countQuery = countQuery.eq('size', size)
  if (brand) countQuery = countQuery.ilike('brand', `%${brand}%`)
  if (minPrice !== null) countQuery = countQuery.gte('price_cents', minPrice)
  if (maxPrice !== null) countQuery = countQuery.lte('price_cents', maxPrice)
  if (condMin !== null)  countQuery = countQuery.gte('condition_score', condMin)
  if (dropped) countQuery = countQuery.eq('is_price_dropped', true)
  if (authenticated) countQuery = countQuery.eq('authentication_status', 'authenticated')

  // ── Run independent queries in parallel ───────────────────────────────────
  const [
    { data: rawListings },
    { count: totalCount },
    { data: deptData },
    { data: catData },
    { data: profileData },
  ] = await Promise.all([
    query,
    countQuery,
    supabase.from('listings').select('department').eq('status', 'active'),
    supabase.from('listings').select('category').eq('status', 'active'),
    supabase.from('profiles').select('sizes, username').eq('id', user.id).single(),
  ])

  const listings = (rawListings ?? []) as Array<{
    id: string; title: string; brand: string; category: string; department: string
    size: string; condition_score: number; price_cents: number; saves_count: number
    is_price_dropped: boolean; authentication_status: string; images: string[]; created_at: string
    profiles: { username: string; id_verification_status: string } | null
  }>

  const hasMore = listings.length > PAGE_SIZE
  const pageListings = hasMore ? listings.slice(0, PAGE_SIZE) : listings
  const displayedIds = pageListings.map(l => l.id)
  const droppedIds = pageListings.filter(l => l.is_price_dropped).map(l => l.id)

  // ── Second parallel batch (depends on listing IDs) ────────────────────────
  const [priceHistoryResult, savesResult] = await Promise.all([
    droppedIds.length > 0
      ? supabase.from('price_history').select('listing_id, old_price_cents, changed_at').in('listing_id', droppedIds).order('changed_at', { ascending: true })
      : Promise.resolve({ data: null }),
    displayedIds.length > 0
      ? supabase.from('saves').select('listing_id').in('listing_id', displayedIds)
      : Promise.resolve({ data: null }),
  ])

  const origPriceMap = new Map<string, number>()
  for (const row of priceHistoryResult.data ?? []) {
    if (!origPriceMap.has(row.listing_id)) {
      origPriceMap.set(row.listing_id, row.old_price_cents)
    }
  }

  const savedSet = new Set((savesResult.data ?? []).map((s: { listing_id: string }) => s.listing_id))

  const browseListing: BrowseListing[] = pageListings.map(l => ({
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
    authentication_status: l.authentication_status,
    images: Array.isArray(l.images) ? l.images : [],
    created_at: l.created_at,
    seller: l.profiles,
    original_price_cents: origPriceMap.get(l.id) ?? null,
    price_display: formatCents(l.price_cents),
  }))

  // Apply the personalized feed order (no-op when disabled/ineligible/unreachable).
  const feed = await feedPromise
  const orderedListings = feed
    ? applyFeedOrder(browseListing, feed.items.map((i) => i.item_id))
    : browseListing

  const filterCounts: FilterCounts = { departments: {}, categories: {} }
  for (const row of deptData ?? []) {
    filterCounts.departments[row.department] = (filterCounts.departments[row.department] ?? 0) + 1
  }
  for (const row of catData ?? []) {
    filterCounts.categories[row.category] = (filterCounts.categories[row.category] ?? 0) + 1
  }

  const userSizes: Record<string, string> = (profileData?.sizes as Record<string, string>) ?? {}
  const username: string = (profileData?.username as string) ?? ''

  return (
    <Suspense>
      <BrowseClient
        initialListings={orderedListings}
        totalCount={totalCount ?? 0}
        filterCounts={filterCounts}
        initialSavedIds={Array.from(savedSet)}
        userSizes={userSizes}
        hasMore={hasMore}
        currentOffset={offset}
        username={username}
        authBadgeEnabled={AUTH_BADGE_ENABLED}
        userId={user.id}
        recsTelemetryEnabled={RECS_TELEMETRY_ENABLED}
      />
    </Suspense>
  )
}
