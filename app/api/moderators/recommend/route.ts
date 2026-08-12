/**
 * POST /api/moderators/recommend   Body: { nomineeId: string }
 *
 * G10: a current moderator (or admin) vouches for a member to become a moderator.
 * When 3 distinct still-valid moderators have vouched, the nominee is promoted
 * automatically inside recommend_moderator() (SECURITY DEFINER). All authorization is
 * enforced in the RPC; the route only maps errors and fires the promotion notification.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isUuid } from '@/lib/security/uuid'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { nomineeId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.nomineeId !== 'string' || !isUuid(body.nomineeId)) {
    return NextResponse.json({ error: 'nomineeId (uuid) required' }, { status: 400 })
  }
  const nomineeId = body.nomineeId

  const { data, error } = await supabase.rpc('recommend_moderator', {
    p_nominee_id: nomineeId,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('not_authenticated'))     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg.includes('not_a_moderator'))       return NextResponse.json({ error: 'Only moderators can recommend' }, { status: 403 })
    if (msg.includes('cannot_recommend_self')) return NextResponse.json({ error: 'You cannot recommend yourself' }, { status: 400 })
    if (msg.includes('nominee_not_found'))     return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (msg.includes('nominee_banned'))        return NextResponse.json({ error: 'Member is suspended' }, { status: 403 })
    if (msg.includes('nominee_not_verified'))  return NextResponse.json({ error: 'Member must be ID-verified first' }, { status: 403 })
    console.error('[moderators/recommend] RPC error:', error)
    return NextResponse.json({ error: 'Failed to record recommendation' }, { status: 500 })
  }

  const result = (data ?? {}) as { distinctCount?: number; promoted?: boolean; alreadyModerator?: boolean }

  // Fire-and-forget promotion notice (fail-soft; never blocks the response).
  if (result.promoted && NOTIFICATIONS_ENABLED) {
    try {
      await notify(createServiceClientRaw(), nomineeId, 'moderator_granted', {})
    } catch (e) {
      console.warn('[moderators/recommend] notify failed (non-blocking):', e)
    }
  }

  return NextResponse.json({
    distinctCount: result.distinctCount ?? 0,
    promoted: result.promoted ?? false,
    alreadyModerator: result.alreadyModerator ?? false,
  })
}
