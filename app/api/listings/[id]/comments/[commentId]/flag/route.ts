/**
 * POST /api/listings/[id]/comments/[commentId]/flag
 * Flag a comment. Inserts a comment_action (flag), then checks auto-flag threshold.
 * Authenticated only. Auto-flags the comment when >=2 flags via DB RPC.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string; commentId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { commentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('comment_actions')
    .insert({ comment_id: commentId, actor_id: user.id, action: 'flag' })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true })
    }
    console.error('[flag] insert error:', error)
    return NextResponse.json({ error: 'Failed to flag' }, { status: 500 })
  }

  // Check threshold (>=2 flags → auto-flag) via service_role
  const service = await createServiceClient()
  await service.rpc('check_and_auto_flag_comment', { p_comment_id: commentId })

  return NextResponse.json({ ok: true })
}
