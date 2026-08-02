/**
 * POST /api/admin/moderation { target_type, target_id, action, reason?, evidence? }
 *
 * Records a moderator action in the append-only audit log via record_moderation_action()
 * (admin-checked in the RPC). Fully handles the audit-only + counter actions —
 * 'dismiss', 'warn', 'uphold_complaint' (the last increments the seller's
 * upheld_complaints, feeding the risk trigger). The SIDE-EFFECTING actions
 * (remove/restore/refund/ban/unban) must be handled by their own dedicated endpoints
 * that perform the effect through the existing money/status paths AND call this to log —
 * they are money/auth-critical and require code-reviewer (see docs/G6_trust_safety.md).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TARGET_TYPES = ['listing', 'user', 'message', 'comment', 'order']
const ACTIONS = ['remove', 'restore', 'warn', 'ban', 'unban', 'refund', 'uphold_complaint', 'dismiss']
// Actions this generic endpoint completes on its own (no external side effect beyond the
// audit row + the upheld_complaints counter). Others require their dedicated handler.
const AUDIT_ONLY = new Set(['dismiss', 'warn', 'uphold_complaint'])

const ERROR_STATUS: Record<string, number> = { not_authenticated: 401, not_authorized: 403 }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { target_type?: unknown; target_id?: unknown; action?: unknown; reason?: unknown; evidence?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { target_type, target_id, action } = body
  if (typeof target_type !== 'string' || !TARGET_TYPES.includes(target_type)) {
    return NextResponse.json({ error: 'invalid target_type' }, { status: 400 })
  }
  if (typeof target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  if (typeof action !== 'string' || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }
  if (!AUDIT_ONLY.has(action)) {
    return NextResponse.json(
      { error: `action '${action}' has side effects — use its dedicated handler` },
      { status: 400 },
    )
  }

  const reason = typeof body.reason === 'string' ? body.reason : null
  const evidence = body.evidence && typeof body.evidence === 'object' ? body.evidence : {}

  const { data, error } = await supabase.rpc('record_moderation_action', {
    p_target_type: target_type,
    p_target_id: target_id,
    p_action: action,
    p_reason: reason,
    p_evidence: evidence,
  })

  if (error) {
    const code = Object.keys(ERROR_STATUS).find((c) => error.message.includes(c))
    if (code) return NextResponse.json({ error: code }, { status: ERROR_STATUS[code] })
    console.error('[moderation] RPC error:', error)
    return NextResponse.json({ error: 'Failed to record action' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action_id: data })
}
