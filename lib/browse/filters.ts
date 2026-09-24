/**
 * Browse filters — ONE parser + ONE query builder shared by the server-rendered
 * first page (app/browse/page.tsx) and the load-more route (app/api/browse), so
 * both return the same rows in the same total order (offset pagination never
 * dups or skips across the page-1 / load-more boundary).
 *
 * URL contract (design 16A rail + results header):
 *   q, dept (csv), cat (csv — whole categories), subcat (csv — `Category:Subcategory`
 *   picks; bare labels resolve via lib/taxonomy), size, sizes (csv — MY SIZES list),
 *   brand (csv, exact labels), color (csv of lib/taxonomy labels, case-insensitive), min_price, max_price (dollars), verified=1,
 *   authenticated=1, dropped=1, sold=1, sort=newest|price_asc|price_desc,
 *   offset. `cond` (minimum condition grade) is still honoured for old links.
 *   DEPARTMENT and CATEGORY are multi-select: departments OR together, and the
 *   catalogue matches any whole category OR any (category AND picked subcategory).
 */
import { BUMP_ENABLED } from '@/lib/flags'
import { DEPARTMENTS, canonicalColor, categoryScopeLabel, departmentScopeLabel, picksByCategory, resolveCategorySelection } from '@/lib/taxonomy'

export type BrowseSort = 'newest' | 'price_asc' | 'price_desc' | 'relevance' | 'most_saved'

export interface BrowseFilters {
  q: string
  /** Departments (rail DEPARTMENT, multi-select; lowercase labels). */
  depts: string[]
  /** Whole categories (rail "All <cat>" rows). Never contains a category that has picks. */
  cats: string[]
  /** Subcategory picks as `Category:Subcategory` keys (rail CATEGORY trees, multi-select). */
  subcats: string[]
  size: string
  /** MY SIZES exact-match list (empty = off). */
  sizes: string[]
  brands: string[]
  colors: string[]
  minPriceCents: number | null
  maxPriceCents: number | null
  condMin: number | null
  verified: boolean
  authenticated: boolean
  dropped: boolean
  sold: boolean
  sort: BrowseSort
  offset: number
}

const csv = (v: string | null | undefined): string[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20)

const dollarsToCents = (v: string | null | undefined): number | null => {
  if (!v) return null
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

type ParamSource = { get(name: string): string | null } | Record<string, string | undefined>

function reader(src: ParamSource): (k: string) => string | null {
  if (typeof (src as { get?: unknown }).get === 'function') return (k) => (src as { get(n: string): string | null }).get(k)
  return (k) => (src as Record<string, string | undefined>)[k] ?? null
}

export function parseBrowseParams(src: ParamSource): BrowseFilters {
  const get = reader(src)
  const sortRaw = get('sort') ?? 'newest'
  const sort: BrowseSort = (['newest', 'price_asc', 'price_desc', 'relevance', 'most_saved'] as const).includes(sortRaw as BrowseSort)
    ? (sortRaw as BrowseSort)
    : 'newest'
  const offsetRaw = parseInt(get('offset') ?? '0', 10)
  const condRaw = get('cond') ? parseInt(get('cond') as string, 10) : NaN
  const depts = csv(get('dept')).map((d) => d.toLowerCase())
  const categories = resolveCategorySelection(csv(get('cat')), csv(get('subcat')))
  return {
    q: (get('q') ?? '').trim().slice(0, 120),
    depts: DEPARTMENTS.filter((d) => depts.includes(d)),
    cats: categories.cats,
    subcats: categories.picks,
    size: (get('size') ?? '').trim(),
    sizes: csv(get('sizes')),
    brands: csv(get('brand')),
    colors: Array.from(new Set(csv(get('color')).map((c) => canonicalColor(c) ?? c))),
    minPriceCents: dollarsToCents(get('min_price')),
    maxPriceCents: dollarsToCents(get('max_price')),
    condMin: Number.isFinite(condRaw) && condRaw >= 1 && condRaw <= 10 ? condRaw : null,
    verified: get('verified') === '1',
    authenticated: get('authenticated') === '1',
    dropped: get('dropped') === '1',
    sold: get('sold') === '1',
    sort,
    offset: Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0,
  }
}

/** True when nothing narrows the catalogue (the recs feed may rerank page 1). */
export function isDiscoveryView(f: BrowseFilters): boolean {
  return !f.q && f.depts.length === 0 && f.cats.length === 0 && f.subcats.length === 0 && !f.size && f.sizes.length === 0 && f.brands.length === 0 &&
    f.colors.length === 0 && f.minPriceCents === null && f.maxPriceCents === null && f.condMin === null &&
    !f.verified && !f.authenticated && !f.dropped && !f.sold && (f.sort === 'newest' || f.sort === 'relevance')
}

/** Rebuild the query string for a filter set (used for saved searches + VIEW links). */
export function browseSearchParams(f: Partial<BrowseFilters>): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.depts?.length) sp.set('dept', f.depts.join(','))
  if (f.cats?.length) sp.set('cat', f.cats.join(','))
  if (f.subcats?.length) sp.set('subcat', f.subcats.join(','))
  if (f.size) sp.set('size', f.size)
  if (f.brands?.length) sp.set('brand', f.brands.join(','))
  if (f.colors?.length) sp.set('color', f.colors.join(','))
  if (f.minPriceCents != null) sp.set('min_price', String(f.minPriceCents / 100))
  if (f.maxPriceCents != null) sp.set('max_price', String(f.maxPriceCents / 100))
  if (f.condMin != null) sp.set('cond', String(f.condMin))
  if (f.verified) sp.set('verified', '1')
  if (f.authenticated) sp.set('authenticated', '1')
  if (f.dropped) sp.set('dropped', '1')
  if (f.sold) sp.set('sold', '1')
  if (f.sort && f.sort !== 'newest') sp.set('sort', f.sort)
  return sp
}

// PostgREST builder methods we rely on. Typed loosely on purpose: the app uses an
// untyped supabase client (see lib/supabase/server.ts) and the same builder is
// used for the count query (head:true) and the row query.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any

/** PostgREST logic-tree value: double-quoted so spaces, commas and `&` in labels are safe. */
const pgVal = (v: string) => `"${v.replace(/"/g, '\\"')}"`
const pgList = (vals: ReadonlyArray<string>) => vals.map(pgVal).join(',')

/**
 * CATEGORY rail → WHERE: whole categories OR (category AND its picked subcategories).
 * Single-group selections stay plain eq/in filters; mixed selections use one `or` group.
 */
export function applyCategoryWhere(query: Builder, f: Pick<BrowseFilters, 'cats' | 'subcats'>): Builder {
  const groups = picksByCategory(f.subcats)
  if (f.cats.length === 0 && groups.length === 0) return query
  if (groups.length === 0) return f.cats.length === 1 ? query.eq('category', f.cats[0]) : query.in('category', f.cats)
  if (f.cats.length === 0 && groups.length === 1) {
    const [g] = groups
    const qb = query.eq('category', g.category)
    return g.subs.length === 1 ? qb.eq('subcategory', g.subs[0]) : qb.in('subcategory', g.subs)
  }
  const parts: string[] = []
  if (f.cats.length) parts.push(`category.in.(${pgList(f.cats)})`)
  for (const g of groups) parts.push(`and(category.eq.${pgVal(g.category)},subcategory.in.(${pgList(g.subs)}))`)
  return query.or(parts.join(','))
}

/** WHERE clauses only — no ordering, no range. Applies to both count and row queries. */
export function applyBrowseWhere(query: Builder, f: BrowseFilters): Builder {
  let qb = query.eq('status', f.sold ? 'sold' : 'active')
  if (f.q) qb = qb.textSearch('search_vector', f.q, { type: 'websearch', config: 'english' })
  if (f.depts.length === 1) qb = qb.eq('department', f.depts[0])
  else if (f.depts.length > 1) qb = qb.in('department', f.depts)
  qb = applyCategoryWhere(qb, f)
  if (f.size) qb = qb.eq('size', f.size)
  else if (f.sizes.length > 0) qb = qb.in('size', f.sizes)
  if (f.brands.length === 1) qb = qb.ilike('brand', `%${f.brands[0]}%`)
  else if (f.brands.length > 1) qb = qb.in('brand', f.brands.map((b) => b.toUpperCase()))
  if (f.colors.length > 0) qb = qb.in('color', f.colors)
  if (f.minPriceCents !== null) qb = qb.gte('price_cents', f.minPriceCents)
  if (f.maxPriceCents !== null) qb = qb.lte('price_cents', f.maxPriceCents)
  if (f.condMin !== null) qb = qb.gte('condition_score', f.condMin)
  if (f.dropped) qb = qb.eq('is_price_dropped', true)
  if (f.authenticated) qb = qb.eq('authentication_status', 'authenticated')
  // Verified sellers: nested-table eq is unreliable in PostgREST for embedded
  // resources; the callers filter on profiles.id_verification_status after the fetch.
  return qb
}

/** ORDER BY — the one total order both pages share. */
export function applyBrowseOrder(query: Builder, f: BrowseFilters): Builder {
  switch (f.sort) {
    case 'price_asc':  return query.order('price_cents', { ascending: true }).order('id')
    case 'price_desc': return query.order('price_cents', { ascending: false }).order('id')
    case 'most_saved': return query.order('saves_count', { ascending: false }).order('id')
    case 'relevance':
      if (f.q) return query.order('id') // ts_rank applied by textSearch
      break
  }
  // Default (NEWEST): paid boost first, then bump freshness, then recency — the same
  // total order as before so offset pagination stays stable across the load-more boundary.
  let qb = query.order('boosted_until', { ascending: false, nullsFirst: false })
  if (BUMP_ENABLED) qb = qb.order('bumped_at', { ascending: false, nullsFirst: false })
  return qb.order('created_at', { ascending: false }).order('id')
}

/** Human "results in X / Y" scope for the results header. */
export function browseScope(f: BrowseFilters): { dept: string; cat: string } {
  return { dept: departmentScopeLabel(f.depts), cat: categoryScopeLabel({ cats: f.cats, picks: f.subcats }) }
}
