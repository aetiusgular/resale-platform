/**
 * POST  /api/reviews { order_id, stars, body?, tags?, photos? } — post a post-transaction review.
 * PATCH /api/reviews { review_id, stars, body?, tags?, photos? } — edit your own review within
 *       48 hours of posting (update_review RPC enforces the window + ownership).
 *
 * Behind REVIEWS_ENABLED. Eligibility (party to a RELEASED order, one per direction) is
 * enforced authoritatively by the post_review() SECURITY DEFINER RPC; we also pre-filter
 * the body through the shared anti-slop filter (same as comments) and map the RPC's
 * P0001 error codes to HTTP. `canLeaveReview` (lib/reviews/eligibility) can gate the UI
 * before this call, but the RPC is the source of truth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { REVIEWS_ENABLED } from '@/lib/flags'
import { filterComment } from '@/lib/comment-filter'
import { allImageUrlsAllowed, storageHost } from '@/lib/security/image-url'
import { REVIEW_MAX_BODY as MAX_BODY, REVIEW_MAX_PHOTOS as MAX_PHOTOS, REVIEW_TAGS } from '@/lib/reviews/tags'

function cleanExtras(body: { tags?: unknown; photos?: unknown }): { tags: string[]; photos: string[] } | { error: string } {
  const tags = Array.isArray(body.tags)
    ? Array.from(new Set(body.tags.filter((t): t is string => typeof t === 'string' && (REVIEW_TAGS as readonly string[]).includes(t))))
    : []
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, MAX_PHOTOS)
    : []
  const host = storageHost()
  if (host && photos.length && !allImageUrlsAllowed(photos, host)) return { error: 'Photos must be uploaded to the platform.' }
  return { tags, photos }
}

const ERROR_STATUS: Record<string, number> = {
  not_authenticated: 401,
  not_a_party: 403,
  order_not_found: 404,
  order_not_completed: 409,
  already_reviewed: 409,
  invalid_stars: 400,
  body_too_long: 400,
  too_many_photos: 400,
  review_not_found: 404,
  edit_window_closed: 409,
}

export async function POST(req: NextRequest) {
  if (!REVIEWS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  let body: { order_id?: unknown; stars?: unknown; body?: unknown; tags?: unknown; photos?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const extras = cleanExtras(body)
  if ('error' in extras) return NextResponse.json({ error: extras.error }, { status: 400 })

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
    p_tags: extras.tags,
    p_photos: extras.photos,
  })

  if (error) {
    const code = Object.keys(ERROR_STATUS).find((c) => error.message.includes(c))
    if (code) return NextResponse.json({ error: code }, { status: ERROR_STATUS[code] })
    console.error('[reviews] RPC error:', error)
    return NextResponse.json({ error: 'Failed to post review' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, review_id: data })
}

export async function PATCH(req: NextRequest) {
  if (!REVIEWS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { review_id?: unknown; stars?: unknown; body?: unknown; tags?: unknown; photos?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.review_id !== 'string') return NextResponse.json({ error: 'review_id (string) required' }, { status: 400 })
  const stars = body.stars
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be an integer 1–5' }, { status: 400 })
  }
  const extras = cleanExtras(body)
  if ('error' in extras) return NextResponse.json({ error: extras.error }, { status: 400 })
  const { body: filteredBody } = filterComment(typeof body.body === 'string' ? body.body.slice(0, MAX_BODY) : '')

  const { error } = await supabase.rpc('update_review', {
    p_review_id: body.review_id,
    p_stars: stars,
    p_body: filteredBody,
    p_tags: extras.tags,
    p_photos: extras.photos,
  })
  if (error) {
    const code = Object.keys(ERROR_STATUS).find((c) => error.message.includes(c))
    if (code) return NextResponse.json({ error: code }, { status: ERROR_STATUS[code] })
    console.error('[reviews] update RPC error:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
