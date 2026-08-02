/**
 * POST /api/webhooks/persona — Persona inquiry status webhook (G4).
 * Verifies the Persona-Signature over the RAW body, records the event idempotently, and on
 * approval flips the referenced user's id_verification_status → 'verified'. Behind
 * VERIFICATION_ENABLED. Auth-critical: verify signature BEFORE trusting anything. code-reviewer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { verifyPersonaSignature, parsePersonaEvent, isApproval, isDecline } from '@/lib/idv/persona'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  if (!VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = await req.text()
  if (!verifyPersonaSignature(raw, req.headers.get('Persona-Signature'), process.env.PERSONA_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const ev = parsePersonaEvent(body)
  if (!ev.eventId) return NextResponse.json({ ok: true })   // nothing actionable

  const service = createServiceClientRaw()

  // Idempotency: one row per provider event. A replay hits the UNIQUE and we no-op.
  const { error: logErr } = await service.from('verification_events').insert({
    provider: 'persona', event_id: ev.eventId, event_name: ev.eventName,
    inquiry_id: ev.inquiryId, reference_id: ev.referenceId, status: ev.status, payload: body,
  })
  if (logErr) {
    if (logErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    console.error('[persona] event log error:', logErr)
    return NextResponse.json({ error: 'record failed' }, { status: 500 }) // let Persona retry
  }

  // Apply the status change only for a real user id.
  if (ev.referenceId && UUID_RE.test(ev.referenceId)) {
    if (isApproval(ev)) {
      await service.from('profiles').update({
        id_verification_status: 'verified', id_verified: true,
        id_verified_at: new Date().toISOString(), persona_inquiry_id: ev.inquiryId,
      }).eq('id', ev.referenceId)
    } else if (isDecline(ev)) {
      await service.from('profiles').update({
        id_verification_status: 'unverified', persona_inquiry_id: ev.inquiryId,
      }).eq('id', ev.referenceId)
    }
  }

  return NextResponse.json({ ok: true })
}
