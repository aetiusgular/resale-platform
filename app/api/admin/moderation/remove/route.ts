/**
 * POST /api/admin/moderation/remove — dedicated side-effecting handler (G6).
 * Hides a listing (status → 'removed') via the service client, then logs exactly ONE
 * moderation_actions row through record_moderation_action (admin-checked inside the RPC).
 *
 * Scope: 'listing' targets only. Messages/comments have their own admin routes; the
 * money/auth verbs ('refund' on an order, 'ban'/'unban' on a user) are separate handlers
 * that must run the existing money path / an auth mechanism and pass code-reviewer.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { recsMarkRemoved } from '@/lib/recs/sync'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.target_type !== 'listing') {
    return NextResponse.json({ error: "remove supports target_type 'listing'" }, { status: 400 })
  }
  if (typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  const targetId = body.target_id
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Removed by moderator'

  const service = createServiceClientRaw()
  const { error: upErr } = await service
    .from('listings')
    .update({ status: 'removed', rejection_reason: reason })
    .eq('id', targetId)
  if (upErr) {
    console.error('[moderation/remove] update error:', upErr)
    return NextResponse.json({ error: 'Failed to remove listing' }, { status: 500 })
  }

  // Recs G1: remove the listing from the recs index (non-blocking, fail-soft).
  after(() => recsMarkRemoved(targetId))

  // Audit AFTER the effect. If this fails the removal stands; surface it so a moderator retries.
  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'listing',
    p_target_id: targetId,
    p_action: 'remove',
    p_reason: reason,
    p_evidence: {},
  })
  if (logErr) {
    console.error('[moderation/remove] audit log error:', logErr)
    return NextResponse.json({ error: 'Listing removed, but the audit log write failed', code: 'audit_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, action_id: actionId })
}
