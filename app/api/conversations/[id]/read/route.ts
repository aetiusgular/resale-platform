/**
 * POST /api/conversations/[id]/read — move the caller's read cursor to now
 * (mark_conversation_read RPC: participant-checked, SECURITY DEFINER). The
 * header MESSAGES badge and the inbox unread counts derive from these cursors.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: id })
  if (error) {
    if (error.message.includes('not_a_participant')) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error('[conversations/:id/read] rpc error:', error)
    return NextResponse.json({ error: 'Could not mark read' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
