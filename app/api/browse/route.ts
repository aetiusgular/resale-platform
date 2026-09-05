/**
 * GET /api/browse — the browse grid as JSON.
 *
 * Same loader as the server-rendered page (lib/loaders/browse), so page 1, load-more pages and
 * the native apps see identical rows in identical order. Access mirrors the web: page 1
 * (`offset=0`) is public; deeper pages are members-only (401 for guests — tests/e2e/browse.spec
 * pins this). MY SIZES is applied server-side: pass `sizes` (csv) or `my_sizes=1` to use the sizes
 * saved on the profile. `include=facets` adds `totalCount`, `filterCounts` and the viewer's size
 * state — what the web page computes for its rail. The legacy keys `{listings, hasMore, savedIds}`
 * are always present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadBrowse } from '@/lib/loaders/browse'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const sp = request.nextUrl.searchParams
  const offsetRaw = parseInt(sp.get('offset') ?? '0', 10)
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
  if (!user && offset > 0) return NextResponse.json({ error: 'Unauthorized', code: 'auth_required' }, { status: 401 })

  const includeFacets = sp.get('include') === 'facets'
  const b = await loadBrowse({ supabase, user, params: sp, includeFacets })

  // Guest responses carry nothing personal: let the CDN absorb repeated facet scans briefly.
  const headers = user ? undefined : { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
  return NextResponse.json({
    listings: b.listings,
    hasMore: b.hasMore,
    savedIds: b.savedIds,
    offset: b.offset,
    ...(includeFacets
      ? {
        totalCount: b.totalCount,
        filterCounts: b.filterCounts,
        userSizes: b.userSizes,
        mySizesOn: b.mySizesOn,
        query: b.filters.q,
      }
      : {}),
  }, { headers })
}
