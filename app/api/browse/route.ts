import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import { BUMP_ENABLED } from '@/lib/flags'
import type { BrowseListing } from '@/app/browse/page'

const PAGE_SIZE = 24

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp      = request.nextUrl.searchParams
  const q       = sp.get('q')?.trim() ?? ''
  const dept    = sp.get('dept') ?? ''
  const cat     = sp.get('cat') ?? ''
  const size    = sp.get('size') ?? ''
  const brand   = sp.get('brand') ?? ''
  const minPrice = sp.get('min_price') ? Math.round(parseFloat(sp.get('min_price')!) * 100) : null
  const maxPrice = sp.get('max_price') ? Math.round(parseFloat(sp.get('max_price')!) * 100) : null
  const condMin  = sp.get('cond') ? parseInt(sp.get('cond')!, 10) : null
  const dropped      = sp.get('dropped') === '1'
  const verifiedOnly = sp.get('verified') === '1'
  const authenticatedOnly = sp.get('authenticated') === '1'
  const sort         = sp.get('sort') ?? 'newest'
  const offset       = sp.get('offset') ? parseInt(sp.get('offset')!, 10) : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('listings')
    .select(`id, title, brand, category, department, size, condition_score, price_cents, saves_count, is_price_dropped, authentication_status, images, created_at, profiles:seller_id (username, id_verification_status)`)
    .eq('status', 'active')

  if (q)     query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' })
  if (dept)  query = query.eq('department', dept)
  if (cat)   query = query.eq('category', cat)
  if (size)  query = query.eq('size', size)
  if (brand) query = query.ilike('brand', `%${brand}%`)
  if (minPrice !== null) query = query.gte('price_cents', minPrice)
  if (maxPrice !== null) query = query.lte('price_cents', maxPrice)
  if (condMin !== null)  query = query.gte('condition_score', condMin)
  if (dropped) query = query.eq('is_price_dropped', true)
  if (authenticatedOnly) query = query.eq('authentication_status', 'authenticated')

  switch (sort) {
    case 'price_asc':  query = query.order('price_cents', { ascending: true }).order('id'); break
    case 'price_desc': query = query.order('price_cents', { ascending: false }).order('id'); break
    case 'most_saved': query = query.order('saves_count', { ascending: false }).order('id'); break
    default:
      // G7: when bump is enabled, freshest bump first (NULLS LAST), then recency.
      // Flag off ⇒ identical to before (created_at DESC). Uses listings_status_bumped_idx.
      if (BUMP_ENABLED) {
        query = query
          .order('bumped_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id')
      } else {
        query = query.order('created_at', { ascending: false }).order('id')
      }
  }

  query = query.range(offset, offset + PAGE_SIZE)

  const { data: rawListings } = await query
  const listings = (rawListings ?? []) as Array<{
    id: string; title: string; brand: string; category: string; department: string
    size: string; condition_score: number; price_cents: number; saves_count: number
    is_price_dropped: boolean; authentication_status: string; images: string[]; created_at: string
    profiles: { username: string; id_verification_status: string } | null
  }>

  // Apply verified-seller filter in app layer (PostgREST nested-table eq is unreliable)
  const filtered = verifiedOnly
    ? listings.filter(l => l.profiles?.id_verification_status === 'verified')
    : listings

  const hasMore = filtered.length > PAGE_SIZE
  const pageListings = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered

  // Fetch price history for dropped listings
  const droppedIds = pageListings.filter(l => l.is_price_dropped).map(l => l.id)
  const origPriceMap = new Map<string, number>()
  if (droppedIds.length > 0) {
    const { data: history } = await supabase
      .from('price_history')
      .select('listing_id, old_price_cents, changed_at')
      .in('listing_id', droppedIds)
      .order('changed_at', { ascending: true })
    for (const row of history ?? []) {
      if (!origPriceMap.has(row.listing_id)) {
        origPriceMap.set(row.listing_id, row.old_price_cents)
      }
    }
  }

  const browseListing: BrowseListing[] = pageListings.map(l => ({
    id: l.id, title: l.title, brand: l.brand, category: l.category, department: l.department,
    size: l.size, condition_score: l.condition_score, price_cents: l.price_cents,
    saves_count: l.saves_count, is_price_dropped: l.is_price_dropped,
    authentication_status: l.authentication_status,
    images: Array.isArray(l.images) ? l.images : [],
    created_at: l.created_at, seller: l.profiles,
    original_price_cents: origPriceMap.get(l.id) ?? null,
    price_display: formatCents(l.price_cents),
  }))

  // Fetch user's saves for these listings
  const ids = browseListing.map(l => l.id)
  let savedIds: string[] = []
  if (ids.length > 0) {
    const { data: savesData } = await supabase
      .from('saves')
      .select('listing_id')
      .in('listing_id', ids)
    savedIds = (savesData ?? []).map(s => s.listing_id)
  }

  return NextResponse.json({ listings: browseListing, hasMore, savedIds })
}
