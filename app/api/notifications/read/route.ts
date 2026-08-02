/**
 * POST /api/notifications/read { id? } — mark one (id) or all unread notifications read.
 * Behind NOTIFICATIONS_ENABLED. RLS + explicit user_id scope keep it to the caller's rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

export async function POST(req: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: unknown } = {}
  try { body = await req.json() } catch { /* mark-all: empty body ok */ }

  let q = supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (typeof body.id === 'string') q = q.eq('id', body.id)

  const { error } = await q
  if (error) {
    console.error('[notifications/read] error:', error)
    return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
