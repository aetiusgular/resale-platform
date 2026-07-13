/**
 * POST /api/admin/comments/[commentId]/pin
 * Admin: toggle pin on a comment. Body: { pinned: boolean }
 * Also ensures status='visible' when pinning.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ commentId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { commentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { pinned?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const pinned = body.pinned === true

  const updatePayload: Record<string, unknown> = { pinned }
  if (pinned) updatePayload.status = 'visible'  // pinning restores if removed

  const { error } = await supabase
    .from('comments')
    .update(updatePayload)
    .eq('id', commentId)

  if (error) {
    console.error('[admin/comments/pin] error:', error)
    return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
