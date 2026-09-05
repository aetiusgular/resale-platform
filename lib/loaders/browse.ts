/**
 * Browse loader — ONE data assembly for the server-rendered first page
 * (app/browse/page.tsx), the load-more route and the native clients (GET /api/browse).
 *
 * Behaviour is exactly what the page did before extraction: guests get page 1 with no
 * personalisation; members get MY SIZES resolution, their saved set, the recs feed rerank on the
 * unfiltered first page, and the boost hoist. Facets are the active catalogue; SOLD is its own
 * count. Everything user-scoped is guarded on `user` and skipped for a signed-out visitor.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { formatCents } from '@/lib/fees'
import { flattenSizes, normalizeSizes, type UserSizes } from '@/lib/sizes'
import { RECS_ENABLED, BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { getFeed } from '@/lib/recs/client'
import { applyFeedOrder } from '@/lib/recs/rank'
import { applyBoostOrder } from '@/lib/boosts'
import { applyBrowseOrder, applyBrowseWhere, isDiscoveryView, parseBrowseParams, type BrowseFilters } from '@/lib/browse/filters'
import { publicImages } from '@/lib/listings/images'

export const BROWSE_PAGE_SIZE = 24

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

export type BrowseResult = {
  listings: BrowseListing[]
  hasMore: boolean
  savedIds: string[]
  offset: number
  /** Exact match count for the current filter set (null when facets were not requested). */
  totalCount: number | null
  filterCounts: FilterCounts | null
  /** The viewer's saved sizes (normalised) — empty for guests. */
  userSizes: UserSizes
  mySizesOn: boolean
  username: string
  /** The parsed filters actually applied (after MY SIZES expansion). */
  filters: BrowseFilters
}

type ParamSource = { get(name: string): string | null } | Record<string, string | undefined>

type RawListing = {
  id: string; title: string; brand: string; category: string; department: string; subcategory: string | null
  size: string; color: string | null; condition_score: number; price_cents: number; saves_count: number
  is_price_dropped: boolean; authentication_status: string; status: string; images: string[]; created_at: string
  boosted_until: string | null; seller_id: string
  profiles: { username: string; id_verification_status: string } | null
}

type FacetRow = {
  department: string; category: string; subcategory: string | null; brand: string | null; color: string | null
  is_price_dropped: boolean; authentication_status: string
  profiles: { id_verification_status: string } | null
}

export async function loadBrowse(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
  user: User | null
  params: ParamSource
  /** Page 1 needs counts + facets; load-more pages do not. */
  includeFacets: boolean
}): Promise<BrowseResult> {
  const { supabase, user, params, includeFacets } = opts
  const get = typeof (params as { get?: unknown }).get === 'function'
    ? (k: string) => (params as { get(n: string): string | null }).get(k)
    : (k: string) => (params as Record<string, string | undefined>)[k] ?? null

  const f = parseBrowseParams(params)

  // Profile (sizes + username + hide-not-my-size) is needed before the listing
  // query when MY SIZES is on, so it is fetched up front for members.
  const { data: profileData } = user
    ? await supabase.from('profiles').select('sizes, username, hide_not_my_size').eq('id', user.id).single()
    : { data: null }
  const userSizes: UserSizes = normalizeSizes(profileData?.sizes)
  const username: string = (profileData?.username as string) ?? ''
  // MY SIZES: on when the URL says so, or by default when the profile switch
  // "Hide listings that aren't my size" is on (my_sizes=0 turns it off for a visit).
  const mySizes = get('my_sizes')
  const mySizesOn = !!user && (mySizes === '1' || (mySizes !== '0' && !!profileData?.hide_not_my_size))
  if (mySizesOn && !f.size && f.sizes.length === 0) f.sizes = flattenSizes(userSizes)

  // ── Personalized ordering (feed→browse): fail-soft, flag-gated ─────────────
  // Only the UNFILTERED first page of pure discovery is reranked.
  const recsEligible = RECS_ENABLED && isDiscoveryView(f) && f.offset === 0 && !!user
  const feedPromise = recsEligible && user ? getFeed({ userId: user.id }) : Promise.resolve(null)

  // ── Row + count queries share ONE WHERE builder ─────────────────────────────
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
  query = query.range(f.offset, f.offset + BROWSE_PAGE_SIZE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase.from('listings').select('id', { count: 'exact', head: true })
  countQuery = applyBrowseWhere(countQuery, f)

  const [
    { data: rawListings },
    countResult,
    facetResult,
    soldResult,
  ] = await Promise.all([
    query,
    includeFacets ? countQuery : Promise.resolve({ count: null }),
    includeFacets
      ? supabase
        .from('listings')
        .select('department, category, subcategory, brand, color, is_price_dropped, authentication_status, profiles:seller_id (id_verification_status)')
        .eq('status', 'active')
      : Promise.resolve({ data: null }),
    includeFacets
      ? supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'sold')
      : Promise.resolve({ count: null }),
  ])

  const listings = (rawListings ?? []) as RawListing[]

  // Verified-seller filter in the app layer (PostgREST nested-table eq is unreliable).
  const filtered = f.verified ? listings.filter((l) => l.profiles?.id_verification_status === 'verified') : listings
  const hasMore = filtered.length > BROWSE_PAGE_SIZE
  const pageListings = hasMore ? filtered.slice(0, BROWSE_PAGE_SIZE) : filtered
  const displayedIds = pageListings.map((l) => l.id)
  const droppedIds = pageListings.filter((l) => l.is_price_dropped).map((l) => l.id)

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
  for (const row of (priceHistoryResult.data ?? []) as Array<{ listing_id: string; old_price_cents: number }>) {
    if (!origPriceMap.has(row.listing_id)) origPriceMap.set(row.listing_id, row.old_price_cents)
  }
  const savedIds = ((savesResult.data ?? []) as Array<{ listing_id: string }>).map((s) => s.listing_id)

  const now = Date.now()
  const browseListing: BrowseListing[] = pageListings.map((l) => ({
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
    images: publicImages(l.images),
    created_at: l.created_at,
    seller: l.profiles,
    original_price_cents: origPriceMap.get(l.id) ?? null,
    price_display: formatCents(l.price_cents),
    // Boosts surface on a page render (includeFacets); load-more pages never did.
    promoted: includeFacets && !!l.boosted_until && new Date(l.boosted_until).getTime() > now,
  }))

  // Apply the personalized feed order (no-op when disabled/ineligible/unreachable).
  const feed = await feedPromise
  const orderedListings = feed
    ? applyFeedOrder(browseListing, feed.items.map((i) => i.item_id))
    : browseListing
  // Paid boosts win the top slots (capped) — applied after any recs re-ranking.
  const finalListings = BOOSTED_POSTS_ENABLED && includeFacets ? applyBoostOrder(orderedListings) : orderedListings

  // ── Facet counts for the rail (active catalogue; SOLD is its own count) ────
  let filterCounts: FilterCounts | null = null
  if (includeFacets) {
    filterCounts = {
      departments: {}, categories: {}, subcategories: {}, brands: [], brandsTotal: 0, colors: {},
      showOnly: { authenticated: 0, verified: 0, dropped: 0, sold: (soldResult as { count: number | null }).count ?? 0 },
    }
    const brandCounts = new Map<string, number>()
    for (const row of ((facetResult as { data: unknown }).data ?? []) as FacetRow[]) {
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
  }

  return {
    listings: finalListings,
    hasMore,
    savedIds,
    offset: f.offset,
    totalCount: includeFacets ? ((countResult as { count: number | null }).count ?? 0) : null,
    filterCounts,
    userSizes,
    mySizesOn,
    username,
    filters: f,
  }
}
