/**
 * POST /api/listings/[id]/comments/[commentId]/agree
 * Agree with a comment. Inserts a comment_action (agree).
 * Authenticated only. UNIQUE constraint deduplicates.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .insert({ comment_id: commentId, actor_id: user.id, action: 'agree' })

  if (error) {
    if (error.code === '23505') {
      // Already agreed — idempotent success
      return NextResponse.json({ ok: true })
    }
    console.error('[agree] insert error:', error)
    return NextResponse.json({ error: 'Failed to agree' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
