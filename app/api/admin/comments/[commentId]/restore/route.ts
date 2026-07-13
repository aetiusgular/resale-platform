/**
 * POST /api/admin/comments/[commentId]/restore
 * Admin: restore a removed/flagged comment to 'visible'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ commentId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
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

  const { error } = await supabase
    .from('comments')
    .update({ status: 'visible' })
    .eq('id', commentId)

  if (error) {
    console.error('[admin/comments/restore] error:', error)
    return NextResponse.json({ error: 'Failed to restore comment' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
