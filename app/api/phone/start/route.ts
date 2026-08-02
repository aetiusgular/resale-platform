/**
 * POST /api/phone/start { phone } — begin phone verification (Branch 4 / L1).
 * Normalizes to E.164, runs Twilio Lookup and BLOCKS VOIP/burner line types, checks the
 * number isn't already tied to another account, then sends an SMS OTP via Twilio Verify.
 * Behind PHONE_VERIFICATION_ENABLED. Lookup fail-opens (a Twilio outage must not lock out
 * real users); the OTP + uniqueness are the hard controls.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { PHONE_VERIFICATION_ENABLED } from '@/lib/flags'
import { checkRateLimit } from '@/lib/rate-limit'
import { normalizeE164 } from '@/lib/phone/line'
import { lookupLineType, sendVerification } from '@/lib/phone/twilio'

export async function POST(req: NextRequest) {
  if (!PHONE_VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`phone_start:${user.id}`, 5, 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })

  let body: { phone?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const e164 = typeof body.phone === 'string' ? normalizeE164(body.phone) : null
  if (!e164) return NextResponse.json({ error: 'Enter a valid phone number.', code: 'invalid_phone' }, { status: 400 })

  const line = await lookupLineType(e164)
  if (line.blocked) {
    return NextResponse.json({ error: 'VOIP and virtual numbers aren’t allowed — use a mobile number.', code: 'voip_blocked' }, { status: 403 })
  }

  const service = createServiceClientRaw()
  const { data: existing } = await service.from('profiles').select('id').eq('phone', e164).neq('id', user.id).maybeSingle()
  if (existing) return NextResponse.json({ error: 'That number is already in use.', code: 'phone_in_use' }, { status: 409 })

  if (!(await sendVerification(e164))) {
    return NextResponse.json({ error: 'Could not send a code. Try again shortly.', code: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
