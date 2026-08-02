/**
 * PUT /api/notifications/prefs { email_offers, push_offers, email_orders, push_orders,
 * email_messages, push_messages } — upsert the caller's channel preferences.
 * Behind NOTIFICATIONS_ENABLED. RLS (notification_prefs_rw_own) scopes to the caller.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

const KEYS = ['email_offers', 'push_offers', 'email_orders', 'push_orders', 'email_messages', 'push_messages', 'email_alerts', 'push_alerts'] as const

export async function PUT(req: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const row: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() }
  for (const k of KEYS) row[k] = body[k] !== false   // default true; only an explicit false disables

  const { error } = await supabase.from('notification_prefs').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[notifications/prefs] upsert error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
