/**
 * "More lots" loader — the rail that closes /listings/[id].
 *
 * Up to `limit` OTHER active listings: the listing's own category first (same department ahead
 * of the other ones, newest first inside each), then the newest of everything else as fill. Each
 * tier is its own capped query, so eight recent rows of one department can never crowd the
 * listing's own department out of the rail. The listing on the page is never in its own rail.
 *
 * Read-only and public: it runs on the caller's client, so RLS decides what is visible (active
 * rows are public read) — no service role, nothing user-specific beyond the viewer's own saved
 * set and the `own` flag. The card DTO mirrors the browse grid's (lib/loaders/browse.ts):
 * public photo slots only (cut by index to slots 0–4 here as well, so the possession proof in
 * slot 5 cannot reach a client whatever the shared helper does), struck original price from the
 * first price_history row. Rail slots are not paid placement, so no card is ever marked
 * `promoted` here.
 *
 * Fail-soft: the rail is decoration under the page's real content. Any query error resolves to
 * an empty rail instead of failing the listing page — logged, so a renamed column does not make
 * the rail vanish silently.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { formatCents } from '@/lib/fees'
import { publicImages } from '@/lib/listings/images'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export const MORE_LOTS_LIMIT = 8

/** Structurally the ListingCard DTO (app/components/listing-card.tsx) plus the two rail flags. */
export type MoreLot = {
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
  original_price_cents: number | null
  price_display: string
  promoted: false
  /** The viewer's own listing — the card shows YOURS and no save control. */
  own: boolean
}

export type MoreLotsResult = { lots: MoreLot[]; savedIds: string[] }

type RawLot = {
  id: string; title: string; brand: string; category: string; department: string; size: string
  condition_score: number; price_cents: number; saves_count: number; is_price_dropped: boolean
  authentication_status: string; images: unknown; created_at: string; seller_id: string
  profiles: { username: string; id_verification_status: string } | null
}

const LOT_SELECT = `
      id, title, brand, category, department, size,
      condition_score, price_cents, saves_count, is_price_dropped, authentication_status,
      images, created_at, seller_id,
      profiles:seller_id (username, id_verification_status)
    `

/**
 * Pure ordering rule, exported for the unit test: same category first (the listing's own
 * department ahead of the other), then the fill rows; input order (newest first) is kept inside
 * every group, ids are unique, the listing itself is dropped, and the result is capped.
 */
export function orderMoreLots<T extends { id: string; category: string; department: string }>(
  sameCategory: readonly T[],
  fill: readonly T[],
  listing: { id: string; category: string; department: string },
  limit: number = MORE_LOTS_LIMIT,
): T[] {
  const seen = new Set<string>([listing.id])
  const out: T[] = []
  const take = (rows: readonly T[]) => {
    for (const row of rows) {
      if (out.length >= limit) return
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
  }
  const same = sameCategory.filter((r) => r.category === listing.category)
  take(same.filter((r) => r.department === listing.department))
  take(same.filter((r) => r.department !== listing.department))
  take(fill)
  return out
}

export async function loadMoreLots(opts: {
  supabase: Client
  user: User | null
  listing: { id: string; category: string; department: string }
  limit?: number
}): Promise<MoreLotsResult> {
  const { supabase, user, listing } = opts
  const limit = opts.limit ?? MORE_LOTS_LIMIT
  const empty: MoreLotsResult = { lots: [], savedIds: [] }

  try {
    const base = () => supabase
      .from('listings')
      .select(LOT_SELECT)
      .eq('status', 'active')
      .neq('id', listing.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    const [ownDeptResult, otherDeptResult, fillResult] = await Promise.all([
      base().eq('category', listing.category).eq('department', listing.department),
      base().eq('category', listing.category).neq('department', listing.department),
      base().neq('category', listing.category),
    ])
    const failed = [ownDeptResult, otherDeptResult, fillResult].filter((r) => r.error)
    if (failed.length > 0) console.warn('[more-lots] query failed:', failed.map((r) => r.error?.message).join(' | '))
    if (failed.length === 3) return empty

    const rows = orderMoreLots(
      [...((ownDeptResult.data ?? []) as unknown as RawLot[]), ...((otherDeptResult.data ?? []) as unknown as RawLot[])],
      (fillResult.data ?? []) as unknown as RawLot[],
      listing,
      limit,
    )
    if (rows.length === 0) return empty

    const ids = rows.map((r) => r.id)
    const droppedIds = rows.filter((r) => r.is_price_dropped).map((r) => r.id)
    const [priceHistoryResult, savesResult] = await Promise.all([
      droppedIds.length > 0
        ? supabase.from('price_history').select('listing_id, old_price_cents, changed_at').in('listing_id', droppedIds).order('changed_at', { ascending: true })
        : Promise.resolve({ data: null }),
      user
        ? supabase.from('saves').select('listing_id').eq('user_id', user.id).in('listing_id', ids)
        : Promise.resolve({ data: null }),
    ])

    const origPriceMap = new Map<string, number>()
    for (const row of (priceHistoryResult.data ?? []) as Array<{ listing_id: string; old_price_cents: number }>) {
      if (!origPriceMap.has(row.listing_id)) origPriceMap.set(row.listing_id, row.old_price_cents)
    }

    const lots: MoreLot[] = rows.map((l) => ({
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
      images: publicImages(l.images),
      created_at: l.created_at,
      seller: l.profiles,
      authentication_status: l.authentication_status,
      original_price_cents: origPriceMap.get(l.id) ?? null,
      price_display: formatCents(l.price_cents),
      promoted: false,
      own: !!user && l.seller_id === user.id,
    }))

    return {
      lots,
      savedIds: ((savesResult.data ?? []) as Array<{ listing_id: string }>).map((s) => s.listing_id),
    }
  } catch (err) {
    console.warn('[more-lots] failed:', err instanceof Error ? err.message : err)
    return empty
  }
}
