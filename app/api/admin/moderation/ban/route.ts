/**
 * POST /api/admin/moderation/ban { target_type:'user', target_id, reason? }
 * Sets profiles.banned = true (+ banned_at / banned_reason) via the service client and
 * logs one moderation_actions row. Cannot ban yourself or another admin. Enforcement is
 * in middleware (pages), assertNotBanned() on sensitive API routes, and at login.
 * code-reviewer: auth action.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.target_type !== 'user') {
    return NextResponse.json({ error: "ban supports target_type 'user'" }, { status: 400 })
  }
  if (typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  const targetId = body.target_id
  if (targetId === user.id) {
    return NextResponse.json({ error: 'cannot_ban_self' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Banned by moderator'

  const service = createServiceClientRaw()
  const { data: target } = await service.from('profiles').select('id, role').eq('id', targetId).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if ((target as { role?: string }).role === 'admin') {
    return NextResponse.json({ error: 'cannot_ban_admin' }, { status: 400 })
  }

  const { error: upErr } = await service
    .from('profiles')
    .update({ banned: true, banned_at: new Date().toISOString(), banned_reason: reason })
    .eq('id', targetId)
  if (upErr) {
    console.error('[moderation/ban] update error:', upErr)
    return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 })
  }

  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'user',
    p_target_id: targetId,
    p_action: 'ban',
    p_reason: reason,
    p_evidence: {},
  })
  if (logErr) {
    console.error('[moderation/ban] audit log error:', logErr)
    return NextResponse.json({ error: 'User banned, but the audit log write failed', code: 'audit_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, action_id: actionId })
}
