/**
 * GET /api/settings/review?order=<uuid> — the LEAVE FEEDBACK → target for one order, same
 * assembly as /settings/review (lib/loaders/settings#loadReviewTarget). 404 when the order is not
 * visible to the viewer. Submission stays on POST /api/reviews.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadReviewTarget } from '@/lib/loaders/settings'
import { ApiError, respond } from '@/lib/api/respond'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  return respond(async () => {
    const orderId = request.nextUrl.searchParams.get('order') ?? ''
    if (!UUID_RE.test(orderId)) throw new ApiError(400, 'order (uuid) required')
    const { supabase, user } = await requireUser()
    const review = await loadReviewTarget({ supabase, user, orderId })
    if (!review) throw new ApiError(404, 'Not found')
    return { review }
  })
}
