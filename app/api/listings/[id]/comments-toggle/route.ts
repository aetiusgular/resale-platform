/**
 * POST /api/listings/[id]/comments-toggle
 * Seller or admin: toggle comments_enabled on a listing (including active ones).
 * Uses toggle_listing_comments() SECURITY DEFINER RPC.
 * Body: { enabled: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: listingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { enabled?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('toggle_listing_comments', {
    p_listing_id: listingId,
    p_enabled:    body.enabled,
  })

  if (error) {
    if (error.message.includes('not_authenticated')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error.message.includes('not_authorized'))   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[comments-toggle] RPC error:', error)
    return NextResponse.json({ error: 'Failed to toggle comments' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
