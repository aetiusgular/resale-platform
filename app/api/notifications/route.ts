/**
 * GET /api/notifications — the signed-in user's recent in-app notifications + unread count.
 * Behind NOTIFICATIONS_ENABLED. RLS restricts rows to the recipient.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

export async function GET() {
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: items }, { count }] = await Promise.all([
    supabase.from('notifications')
      .select('id, type, title, body, url, data, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
  ])
  return NextResponse.json({ items: items ?? [], unread: count ?? 0 })
}
