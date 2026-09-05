/**
 * GET /api/checkout/preview?listingId=<uuid>&offerId=<uuid> — the checkout summary card WITHOUT
 * creating a PaymentIntent or locking the listing (lib/loaders/checkout). The app calls
 * POST /api/checkout only when the buyer taps PAY; that response's `orderSummary` is authoritative.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadCheckoutPreview } from '@/lib/loaders/checkout'
import { ApiError, respond } from '@/lib/api/respond'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  return respond(async () => {
    const sp = request.nextUrl.searchParams
    const listingId = sp.get('listingId') ?? ''
    if (!UUID_RE.test(listingId)) throw new ApiError(400, 'listingId (uuid) required')
    const { supabase, user } = await requireUser()
    const preview = await loadCheckoutPreview({ supabase, user, listingId, offerId: sp.get('offerId') })
    if (!preview) throw new ApiError(404, 'Not found')
    return preview
  })
}
