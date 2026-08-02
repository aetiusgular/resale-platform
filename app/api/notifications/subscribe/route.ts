/**
 * POST   /api/notifications/subscribe { endpoint, keys:{p256dh,auth} } — register a device
 * DELETE /api/notifications/subscribe { endpoint } — remove it
 * Behind NOTIFICATIONS_ENABLED. RLS (push_subs_rw_own) scopes rows to the caller.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

export async function POST(req: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'endpoint + keys.p256dh + keys.auth required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'user_id,endpoint' })
  if (error) {
    console.error('[notifications/subscribe] upsert error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { endpoint?: unknown } = {}
  try { body = await req.json() } catch { /* delete-all fallback */ }

  let q = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  if (typeof body.endpoint === 'string') q = q.eq('endpoint', body.endpoint)
  const { error } = await q
  if (error) return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
