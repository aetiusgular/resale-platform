/**
 * POST /api/admin/moderation/authenticate { target_type:'listing', target_id, reason? }
 * Marks a listing 'authenticated' (G5) — shows the AUTHENTICATED badge + powers the browse
 * filter. Only from the 'pending' review queue. Service-role write + one moderation_actions
 * audit row. Admin-only. Behind AUTH_BADGE_ENABLED.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { AUTH_BADGE_ENABLED } from '@/lib/flags'

export async function POST(req: NextRequest) {
  if (!AUTH_BADGE_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.target_type !== 'listing') return NextResponse.json({ error: "authenticate supports target_type 'listing'" }, { status: 400 })
  if (typeof body.target_id !== 'string') return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  const targetId = body.target_id
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Authenticated by moderator'

  const service = createServiceClientRaw()
  const { error } = await service
    .from('listings')
    .update({ authentication_status: 'authenticated' })
    .eq('id', targetId)
    .eq('authentication_status', 'pending')
  if (error) {
    console.error('[moderation/authenticate] update error:', error)
    return NextResponse.json({ error: 'Failed to authenticate listing' }, { status: 500 })
  }

  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'listing', p_target_id: targetId, p_action: 'authenticate', p_reason: reason, p_evidence: {},
  })
  if (logErr) return NextResponse.json({ error: 'Authenticated, but the audit log write failed', code: 'audit_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, action_id: actionId })
}
