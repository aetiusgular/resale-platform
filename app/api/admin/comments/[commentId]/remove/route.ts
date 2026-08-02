/**
 * POST /api/admin/comments/[commentId]/remove
 * Admin: set comment status to 'removed'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isUuid } from '@/lib/security/uuid'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ commentId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { commentId } = await params
  if (!isUuid(commentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('comments')
    .update({ status: 'removed' })
    .eq('id', commentId)

  if (error) {
    console.error('[admin/comments/remove] error:', error)
    return NextResponse.json({ error: 'Failed to remove comment' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
