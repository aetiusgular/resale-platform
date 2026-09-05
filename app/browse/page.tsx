import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import BrowseClient from './browse-client'
import JsonLd from '@/app/components/json-ld'
import AppShell from '@/app/components/app-shell'
import { flattenSizes, normalizeSizes, type UserSizes } from '@/lib/sizes'
import { organizationJsonLd, webSiteJsonLd } from '@/lib/seo-listing'
import { AUTH_BADGE_ENABLED, RECS_ENABLED, RECS_TELEMETRY_ENABLED, BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { getFeed } from '@/lib/recs/client'
import { applyFeedOrder } from '@/lib/recs/rank'
import { applyBoostOrder } from '@/lib/boosts'
import { applyBrowseOrder, applyBrowseWhere, isDiscoveryView, parseBrowseParams } from '@/lib/browse/filters'

export const metadata: Metadata = {
  title: 'Browse',
  description: 'Browse curated secondhand fashion listings.',
  // Every filter/sort/offset/q permutation canonicalizes to clean /browse —
  // facet URLs are never the ranking surface (brand/category landing pages
  // will be, once the wiki exists).
  alternates: { canonical: '/browse' },
}

const PAGE_SIZE = 24

export type BrowseListing = {
  id: string
  title: string
  brand: string
  category: string
  department: string
  subcategory: string | null
  size: string
  color: string | null
  condition_score: number
  price_cents: number
  saves_count: number
  is_price_dropped: boolean
  images: string[]
  created_at: string
  seller: { username: string; id_verification_status: string } | null
  authentication_status: string
  /** status === 'sold' (SHOW ONLY → Sold items) */
  sold: boolean
  /** The viewer's own listing — the card shows BUMP ↗ instead of the timestamp */
  own: boolean
  // Derived on server
  original_price_cents: number | null
  price_display: string
  promoted: boolean
}

export type FilterCounts = {
  departments: Record<string, number>
  categories: Record<string, number>
  /** category → subcategory → count (rail: expandable CATEGORY trees) */
  subcategories: Record<string, Record<string, number>>
  /** Top designers among active listings — label → count, sorted desc */
  brands: Array<{ label: string; count: number }>
  /** Distinct designers with an active listing (rail: "VIEW ALL n →") */
  brandsTotal: number
  colors: Record<string, number>
  showOnly: { authenticated: number; verified: number; dropped: number; sold: number }
}

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Guests browse freely (user === null). Everything user-scoped below — the
  // personalized feed, the saved-set, the profile size prefs — is guarded on
  // `user` and simply skipped for a signed-out visitor. Write actions are gated
  // client-side (auth popup) and server-side (401 + RLS).
  const { data: { user } } = await supabase.auth.getUser()

  const f = parseBrowseParams(params)
  const q = f.q

  // Profile (sizes + username + hide-not-my-size) is needed before the listing
  // query when MY SIZES is on, so it is fetched up front for members.
  const { data: profileData } = user
    ? await supabase.from('profiles').select('sizes, username, hide_not_my_size').eq('id', user.id).single()
    : { data: null }
  const userSizes: UserSizes = normalizeSizes(profileData?.sizes)
  const username: string = (profileData?.username as string) ?? ''
  // MY SIZES: on when the URL says so, or by default when the profile switch
  // "Hide listings that aren't my size" is on (my_sizes=0 turns it off for a visit).
  const mySizesOn = !!user && (params.my_sizes === '1' || (params.my_sizes !== '0' && !!profileData?.hide_not_my_size))
  if (mySizesOn && !f.size && f.sizes.length === 0) f.sizes = flattenSizes(userSizes)

  // ── Personalized ordering (feed→browse): fail-soft, flag-gated ─────────────
  // Only the UNFILTERED first page of pure discovery is reranked. Any search,
  // filter, explicit price/condition, or deeper page keeps the deterministic
  // default order. The feed fetch runs concurrently with the listing queries.
  const recsEligible = RECS_ENABLED && isDiscoveryView(f) && f.offset === 0 && !!user
  const feedPromise = recsEligible && user ? getFeed({ userId: user.id }) : Promise.resolve(null)

  // ── Row + count queries share ONE WHERE builder with the load-more route ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('listings')
    .select(`
      id, title, brand, category, department, subcategory, size, color,
      condition_score, price_cents, saves_count, is_price_dropped, authentication_status, status,
      images, created_at, boosted_until, seller_id,
      profiles:seller_id (username, id_verification_status)
    `)
  query = applyBrowseWhere(query, f)
  query = applyBrowseOrder(query, f)
  query = query.range(f.offset, f.offset + PAGE_SIZE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase.from('listings').select('id', { count: 'exact', head: true })
  countQuery = applyBrowseWhere(countQuery, f)

  // ── Run independent queries in parallel ───────────────────────────────────
  const [
    { data: rawListings },
    { count: totalCount },
    { data: facetData },
    { count: soldCount },
  ] = await Promise.all([
    query,
    countQuery,
    supabase
      .from('listings')
      .select('department, category, subcategory, brand, color, is_price_dropped, authentication_status, profiles:seller_id (id_verification_status)')
      .eq('status', 'active'),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
  ])

  const listings = (rawListings ?? []) as Array<{
    id: string; title: string; brand: string; category: string; department: string; subcategory: string | null
    size: string; color: string | null; condition_score: number; price_cents: number; saves_count: number
    is_price_dropped: boolean; authentication_status: string; status: string; images: string[]; created_at: string
    boosted_until: string | null; seller_id: string
    profiles: { username: string; id_verification_status: string } | null
  }>

  // Verified-seller filter in the app layer (PostgREST nested-table eq is unreliable).
  const filtered = f.verified ? listings.filter((l) => l.profiles?.id_verification_status === 'verified') : listings
  const hasMore = filtered.length > PAGE_SIZE
  const pageListings = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered
  const displayedIds = pageListings.map(l => l.id)
  const droppedIds = pageListings.filter(l => l.is_price_dropped).map(l => l.id)

  // ── Second parallel batch (depends on listing IDs) ────────────────────────
  const [priceHistoryResult, savesResult] = await Promise.all([
    droppedIds.length > 0
      ? supabase.from('price_history').select('listing_id, old_price_cents, changed_at').in('listing_id', droppedIds).order('changed_at', { ascending: true })
      : Promise.resolve({ data: null }),
    user && displayedIds.length > 0
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
    subcategory: l.subcategory ?? null,
    size: l.size,
    color: l.color ?? null,
    condition_score: l.condition_score,
    price_cents: l.price_cents,
    saves_count: l.saves_count,
    is_price_dropped: l.is_price_dropped,
    authentication_status: l.authentication_status,
    sold: l.status === 'sold',
    own: !!user && l.seller_id === user.id,
    images: Array.isArray(l.images) ? l.images : [],
    created_at: l.created_at,
    seller: l.profiles,
    original_price_cents: origPriceMap.get(l.id) ?? null,
    price_display: formatCents(l.price_cents),
    // eslint-disable-next-line react-hooks/purity -- server component render; boost freshness at request time
    promoted: !!l.boosted_until && new Date(l.boosted_until).getTime() > Date.now(),
  }))

  // Apply the personalized feed order (no-op when disabled/ineligible/unreachable).
  const feed = await feedPromise
  const orderedListings = feed
    ? applyFeedOrder(browseListing, feed.items.map((i) => i.item_id))
    : browseListing
  // Paid boosts win the top slots (capped) — applied after any recs re-ranking.
  const finalListings = BOOSTED_POSTS_ENABLED ? applyBoostOrder(orderedListings) : orderedListings

  // ── Facet counts for the rail (active catalogue; SOLD is its own count) ────
  const filterCounts: FilterCounts = {
    departments: {}, categories: {}, subcategories: {}, brands: [], brandsTotal: 0, colors: {},
    showOnly: { authenticated: 0, verified: 0, dropped: 0, sold: soldCount ?? 0 },
  }
  const brandCounts = new Map<string, number>()
  type FacetRow = {
    department: string; category: string; subcategory: string | null; brand: string | null; color: string | null
    is_price_dropped: boolean; authentication_status: string
    profiles: { id_verification_status: string } | null
  }
  for (const row of (facetData ?? []) as unknown as FacetRow[]) {
    filterCounts.departments[row.department] = (filterCounts.departments[row.department] ?? 0) + 1
    filterCounts.categories[row.category] = (filterCounts.categories[row.category] ?? 0) + 1
    if (row.subcategory) {
      const subs = (filterCounts.subcategories[row.category] ??= {})
      subs[row.subcategory] = (subs[row.subcategory] ?? 0) + 1
    }
    if (row.brand) brandCounts.set(row.brand, (brandCounts.get(row.brand) ?? 0) + 1)
    if (row.color) filterCounts.colors[row.color] = (filterCounts.colors[row.color] ?? 0) + 1
    if (row.authentication_status === 'authenticated') filterCounts.showOnly.authenticated++
    if (row.profiles?.id_verification_status === 'verified') filterCounts.showOnly.verified++
    if (row.is_price_dropped) filterCounts.showOnly.dropped++
  }
  filterCounts.brandsTotal = brandCounts.size
  filterCounts.brands = Array.from(brandCounts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 12)

  return (
    <>
      {/* Effective homepage (/ redirects here): site-level structured data. */}
      <JsonLd data={webSiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <AppShell username={username} searchValue={q}>
        <Suspense>
          <BrowseClient
            initialListings={finalListings}
            totalCount={totalCount ?? 0}
            filterCounts={filterCounts}
            initialSavedIds={Array.from(savedSet)}
            userSizes={userSizes}
            mySizesOn={mySizesOn}
            hasMore={hasMore}
            currentOffset={f.offset}
            username={username}
            authBadgeEnabled={AUTH_BADGE_ENABLED}
            userId={user?.id ?? ''}
            recsTelemetryEnabled={RECS_TELEMETRY_ENABLED}
          />
        </Suspense>
      </AppShell>
    </>
  )
}
