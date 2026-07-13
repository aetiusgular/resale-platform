/**
 * GET  /api/listings/[id]/comments?tab=lc|general
 * Fetch visible comments for a listing tab (public).
 *
 * POST /api/listings/[id]/comments
 * Post a comment via post_comment() SECURITY DEFINER RPC.
 * Requires: authenticated, id_verification_status=verified (or admin).
 * Redaction filter applied before RPC call.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { filterComment } from '@/lib/comment-filter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id: listingId } = await params
  const tab = req.nextUrl.searchParams.get('tab') ?? 'lc'
  if (tab !== 'lc' && tab !== 'general') {
    return NextResponse.json({ error: 'tab must be lc or general' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch comments + agree counts + author profile (username, tier, verified_checker)
  // RLS: public read for visible comments on active listings
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id, listing_id, author_id, parent_id, thread_type, body,
      status, redacted, pinned, created_at,
      profiles:author_id (username, tier, verified_checker, role),
      comment_actions (id, action)
    `)
    .eq('listing_id', listingId)
    .eq('thread_type', tab)
    .eq('status', 'visible')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[comments] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }

  return NextResponse.json({ comments: comments ?? [] })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: listingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: unknown; thread_type?: unknown; parent_id?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }
  if (body.body.length > 2000) {
    return NextResponse.json({ error: 'Comment too long (max 2000 chars)' }, { status: 422 })
  }

  const threadType = body.thread_type
  if (threadType !== 'lc' && threadType !== 'general') {
    return NextResponse.json({ error: 'thread_type must be lc or general' }, { status: 400 })
  }

  const parentId = typeof body.parent_id === 'string' ? body.parent_id : null

  // Apply link/payment redaction filter
  const { redacted, body: filteredBody } = filterComment(body.body.trim())

  // Call SECURITY DEFINER RPC — all checks (id verification, rate limit, LC gate) are inside
  const { data: commentId, error: rpcErr } = await supabase.rpc('post_comment', {
    p_listing_id:  listingId,
    p_thread_type: threadType,
    p_body:        filteredBody,
    p_redacted:    redacted,
    p_parent_id:   parentId,
  })

  if (rpcErr) {
    const msg = rpcErr.message
    if (msg.includes('not_authenticated'))          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg.includes('id_verification_required'))   return NextResponse.json({ error: 'ID verification required to comment' }, { status: 403 })
    if (msg.includes('listing_not_found'))          return NextResponse.json({ error: 'Listing not found or inactive' }, { status: 404 })
    if (msg.includes('lc_permission_denied'))       return NextResponse.json({ error: 'Legit-check thread requires verified checker or Gold tier' }, { status: 403 })
    if (msg.includes('comments_disabled'))          return NextResponse.json({ error: 'Comments are disabled on this listing' }, { status: 403 })
    if (msg.includes('rate_limit_exceeded'))        return NextResponse.json({ error: 'Rate limit: new accounts may post 2 comments per day' }, { status: 429 })
    if (msg.includes('parent_comment_not_found'))   return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
    console.error('[comments] post_comment RPC error:', rpcErr)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  return NextResponse.json({ id: commentId, redacted }, { status: 201 })
}
