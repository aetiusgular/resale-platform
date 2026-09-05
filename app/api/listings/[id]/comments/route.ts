/**
 * GET  /api/listings/[id]/comments        — fetch visible Legit Check comments (public)
 *                                           plus the thread tallies (legit / flagged votes,
 *                                           auto-auth result, moderator verdict).
 * POST /api/listings/[id]/comments        — post an LC comment (+ optional LEGIT / FLAG
 *                                           vote) via post_comment() RPC.
 *
 * Community legit check (ARCHIVE design review): any verified member can weigh in and
 * cast one vote per listing; moderators sign the verdict (pinned). General comments stay
 * removed (G10). Auto-auth system verdicts (source='auto') are inserted server-side via
 * post_auto_lc(), not here.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { filterComment } from '@/lib/comment-filter'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id: listingId } = await params
  const tab = req.nextUrl.searchParams.get('tab') ?? 'lc'
  if (tab !== 'lc') {
    // General comments were removed (G10). Only the LC thread exists.
    return NextResponse.json({ error: 'Only the legit-check thread exists' }, { status: 400 })
  }

  const supabase = await createClient()

  // RLS: public read for visible comments on active listings.
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id, listing_id, author_id, parent_id, thread_type, body,
      status, redacted, pinned, source, verdict, vote, created_at,
      profiles:author_id (username, tier, verified_checker, role, is_moderator, checker_category),
      comment_actions (id, action)
    `)
    .eq('listing_id', listingId)
    .eq('thread_type', 'lc')
    .eq('status', 'visible')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[comments] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }

  // Thread tallies for the LC strip: "n LEGIT · n FLAGGED", auto-auth, mod verdict.
  const rows = (comments ?? []) as Array<{ vote?: string | null; source?: string; verdict?: string | null; pinned?: boolean }>
  const legit = rows.filter((c) => c.vote === 'legit').length
  const flagged = rows.filter((c) => c.vote === 'flag').length
  const auto = rows.find((c) => c.source === 'auto')
  const autoAuth = auto?.verdict === 'authentic' ? 'TAG PASS' : auto?.verdict === 'counterfeit' ? 'TAG FAIL' : auto ? 'UNCERTAIN' : 'PENDING'
  const { data: listing } = await supabase.from('listings').select('authentication_status').eq('id', listingId).maybeSingle()
  const status = (listing as { authentication_status?: string } | null)?.authentication_status ?? 'none'
  const verdict = status === 'authenticated' ? 'LEGIT' : status === 'rejected' ? 'NOT LEGIT' : 'PENDING'

  return NextResponse.json({ comments: comments ?? [], tally: { legit, flagged, autoAuth, verdict } })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: listingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  let body: { body?: unknown; thread_type?: unknown; parent_id?: unknown; vote?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }
  const vote = body.vote === 'legit' || body.vote === 'flag' ? body.vote : null

  // Community posting is open to every verified member, so it is rate limited.
  const rl = await checkRateLimit(`lc_post:${user.id}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many legit-check posts — try again in a bit.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }
  if (body.body.length > 2000) {
    return NextResponse.json({ error: 'Comment too long (max 2000 chars)' }, { status: 422 })
  }

  // Only the LC thread exists post-G10. Accept a missing thread_type (defaults to lc);
  // reject anything else.
  const threadType = body.thread_type ?? 'lc'
  if (threadType !== 'lc') {
    return NextResponse.json({ error: 'General comments have been removed' }, { status: 410 })
  }

  const parentId = typeof body.parent_id === 'string' ? body.parent_id : null

  // Apply link/payment redaction filter.
  const { redacted, body: filteredBody } = filterComment(body.body.trim())

  // SECURITY DEFINER RPC — verification gate, vote handling and all checks are inside.
  const { data: commentId, error: rpcErr } = await supabase.rpc('post_comment', {
    p_listing_id:  listingId,
    p_thread_type: 'lc',
    p_body:        filteredBody,
    p_redacted:    redacted,
    p_parent_id:   parentId,
    p_vote:        vote,
  })

  if (rpcErr) {
    const msg = rpcErr.message
    if (msg.includes('not_authenticated'))          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg.includes('id_verification_required'))   return NextResponse.json({ error: 'ID verification required' }, { status: 403 })
    if (msg.includes('listing_not_found'))          return NextResponse.json({ error: 'Listing not found or inactive' }, { status: 404 })
    if (msg.includes('lc_permission_denied'))       return NextResponse.json({ error: 'Legit checks are posted by moderators only' }, { status: 403 })
    if (msg.includes('banned'))                     return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
    if (msg.includes('invalid_vote'))               return NextResponse.json({ error: 'Vote must be legit or flag' }, { status: 400 })
    if (msg.includes('general_comments_removed'))   return NextResponse.json({ error: 'General comments have been removed' }, { status: 410 })
    if (msg.includes('parent_comment_not_found'))   return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
    console.error('[comments] post_comment RPC error:', rpcErr)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  return NextResponse.json({ id: commentId, redacted, vote }, { status: 201 })
}
