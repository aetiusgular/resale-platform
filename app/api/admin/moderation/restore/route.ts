/**
 * POST /api/admin/moderation/restore — dedicated side-effecting handler (G6).
 * Restores a previously removed listing (status → 'active', clears rejection_reason)
 * via the service client, then logs exactly ONE moderation_actions row.
 * Scope: 'listing' targets only (see remove/route.ts for the rationale).
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

  if (body.target_type !== 'listing') {
    return NextResponse.json({ error: "restore supports target_type 'listing'" }, { status: 400 })
  }
  if (typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  const targetId = body.target_id
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null

  const service = createServiceClientRaw()
  const { error: upErr } = await service
    .from('listings')
    .update({ status: 'active', rejection_reason: null })
    .eq('id', targetId)
  if (upErr) {
    console.error('[moderation/restore] update error:', upErr)
    return NextResponse.json({ error: 'Failed to restore listing' }, { status: 500 })
  }

  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'listing',
    p_target_id: targetId,
    p_action: 'restore',
    p_reason: reason,
    p_evidence: {},
  })
  if (logErr) {
    console.error('[moderation/restore] audit log error:', logErr)
    return NextResponse.json({ error: 'Listing restored, but the audit log write failed', code: 'audit_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, action_id: actionId })
}
