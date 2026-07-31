/**
 * POST /api/reviews { order_id, stars, body? } — post a post-transaction review.
 *
 * Behind REVIEWS_ENABLED. Eligibility (party to a RELEASED order, one per direction) is
 * enforced authoritatively by the post_review() SECURITY DEFINER RPC; we also pre-filter
 * the body through the shared anti-slop filter (same as comments) and map the RPC's
 * P0001 error codes to HTTP. `canLeaveReview` (lib/reviews/eligibility) can gate the UI
 * before this call, but the RPC is the source of truth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { REVIEWS_ENABLED } from '@/lib/flags'
import { filterComment } from '@/lib/comment-filter'

const MAX_BODY = 1000

const ERROR_STATUS: Record<string, number> = {
  not_authenticated: 401,
  not_a_party: 403,
  order_not_found: 404,
  order_not_completed: 409,
  already_reviewed: 409,
  invalid_stars: 400,
}

export async function POST(req: NextRequest) {
  if (!REVIEWS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { order_id?: unknown; stars?: unknown; body?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const orderId = body.order_id
  const stars = body.stars
  if (typeof orderId !== 'string') {
    return NextResponse.json({ error: 'order_id (string) required' }, { status: 400 })
  }
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be an integer 1–5' }, { status: 400 })
  }
  const rawBody = typeof body.body === 'string' ? body.body.slice(0, MAX_BODY) : ''
  const { body: filteredBody } = filterComment(rawBody)

  const { data, error } = await supabase.rpc('post_review', {
    p_order_id: orderId,
    p_stars: stars,
    p_body: filteredBody,
  })

  if (error) {
    const code = Object.keys(ERROR_STATUS).find((c) => error.message.includes(c))
    if (code) return NextResponse.json({ error: code }, { status: ERROR_STATUS[code] })
    console.error('[reviews] RPC error:', error)
    return NextResponse.json({ error: 'Failed to post review' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, review_id: data })
}
