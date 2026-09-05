/**
 * GET /api/browse — load-more pages for the browse grid. Members only (401 for
 * guests — page 1 is public, deeper pages ask for an account; tests/e2e/browse.spec
 * pins this). Uses the same parser + WHERE/ORDER builders as the server-rendered
 * first page (lib/browse/filters) so pagination is stable across the boundary.
 * MY SIZES is applied server-side: pass `sizes` (csv) or `my_sizes=1` to use the
 * sizes saved on the profile.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import { applyBrowseOrder, applyBrowseWhere, parseBrowseParams } from '@/lib/browse/filters'
import { flattenSizes, normalizeSizes } from '@/lib/sizes'
import type { BrowseListing } from '@/app/browse/page'

const PAGE_SIZE = 24

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const f = parseBrowseParams(sp)

  if (sp.get('my_sizes') === '1' && f.sizes.length === 0 && !f.size) {
    const { data: profile } = await supabase.from('profiles').select('sizes').eq('id', user.id).single()
    f.sizes = flattenSizes(normalizeSizes(profile?.sizes))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('listings')
    .select(`id, title, brand, category, department, subcategory, size, color, condition_score, price_cents, saves_count, is_price_dropped, authentication_status, status, images, created_at, seller_id, profiles:seller_id (username, id_verification_status)`)
  query = applyBrowseWhere(query, f)
  query = applyBrowseOrder(query, f)
  query = query.range(f.offset, f.offset + PAGE_SIZE)

  const { data: rawListings } = await query
  const listings = (rawListings ?? []) as Array<{
    id: string; title: string; brand: string; category: string; department: string; subcategory: string | null
    size: string; color: string | null; condition_score: number; price_cents: number; saves_count: number
    is_price_dropped: boolean; authentication_status: string; status: string; images: string[]; created_at: string
    seller_id: string; profiles: { username: string; id_verification_status: string } | null
  }>

  // Verified-seller filter in the app layer (PostgREST nested-table eq is unreliable).
  const filtered = f.verified ? listings.filter((l) => l.profiles?.id_verification_status === 'verified') : listings

  const hasMore = filtered.length > PAGE_SIZE
  const pageListings = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered

  // Original price for PRICE DROP cards.
  const droppedIds = pageListings.filter((l) => l.is_price_dropped).map((l) => l.id)
  const origPriceMap = new Map<string, number>()
  if (droppedIds.length > 0) {
    const { data: history } = await supabase
      .from('price_history')
      .select('listing_id, old_price_cents, changed_at')
      .in('listing_id', droppedIds)
      .order('changed_at', { ascending: true })
    for (const row of history ?? []) {
      if (!origPriceMap.has(row.listing_id)) origPriceMap.set(row.listing_id, row.old_price_cents)
    }
  }

  const browseListing: BrowseListing[] = pageListings.map((l) => ({
    id: l.id, title: l.title, brand: l.brand, category: l.category, department: l.department,
    subcategory: l.subcategory ?? null, color: l.color ?? null,
    size: l.size, condition_score: l.condition_score, price_cents: l.price_cents,
    saves_count: l.saves_count, is_price_dropped: l.is_price_dropped,
    authentication_status: l.authentication_status,
    sold: l.status === 'sold',
    own: l.seller_id === user.id,
    images: Array.isArray(l.images) ? l.images : [],
    created_at: l.created_at, seller: l.profiles,
    original_price_cents: origPriceMap.get(l.id) ?? null,
    price_display: formatCents(l.price_cents),
    promoted: false, // load-more pages don't surface boosts (page 1 only)
  }))

  // The caller's saves for these rows (members only).
  const ids = browseListing.map((l) => l.id)
  let savedIds: string[] = []
  if (ids.length > 0) {
    const { data: savesData } = await supabase.from('saves').select('listing_id').in('listing_id', ids)
    savedIds = (savesData ?? []).map((s) => s.listing_id)
  }

  return NextResponse.json({ listings: browseListing, hasMore, savedIds })
}
