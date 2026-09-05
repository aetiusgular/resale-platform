/**
 * GET /api/sell/new?edit=<uuid>|draft=<uuid> — what the wizard needs before it opens: the seller
 * ID-verification gate (`must_verify` → the app shows the verify gate, as /sell/new redirects),
 * fee inputs, and the prefill for an edit or a continued draft. 404 when the id does not resolve
 * to a usable listing of the viewer's for that mode (the page redirects to /sell).
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadSellNew } from '@/lib/loaders/sell'
import { ApiError, respond } from '@/lib/api/respond'

export async function GET(request: NextRequest) {
  return respond(async () => {
    const sp = request.nextUrl.searchParams
    const { supabase, user } = await requireUser()
    const g = await loadSellNew({ supabase, user, draft: sp.get('draft'), edit: sp.get('edit') })
    if (g.row_missing) throw new ApiError(404, 'Listing not found for this mode')
    return g
  })
}
