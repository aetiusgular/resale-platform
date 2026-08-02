/**
 * POST /api/phone/verify { phone, code } — confirm the SMS OTP (Branch 4 / L1).
 * Checks the code via Twilio Verify, then writes the verified phone onto the profile. The
 * partial UNIQUE index enforces one-number-one-account (a race lands as 23505 → 409).
 * Behind PHONE_VERIFICATION_ENABLED. Writes use the service role (phone isn't in the
 * client UPDATE grant).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { PHONE_VERIFICATION_ENABLED } from '@/lib/flags'
import { normalizeE164 } from '@/lib/phone/line'
import { checkVerification } from '@/lib/phone/twilio'

export async function POST(req: NextRequest) {
  if (!PHONE_VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { phone?: unknown; code?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const e164 = typeof body.phone === 'string' ? normalizeE164(body.phone) : null
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!e164) return NextResponse.json({ error: 'Enter a valid phone number.', code: 'invalid_phone' }, { status: 400 })
  if (!code) return NextResponse.json({ error: 'Enter the code.', code: 'invalid_code' }, { status: 400 })

  if (!(await checkVerification(e164, code))) {
    return NextResponse.json({ error: 'That code isn’t right. Try again.', code: 'invalid_code' }, { status: 400 })
  }

  const service = createServiceClientRaw()
  const { error } = await service
    .from('profiles')
    .update({ phone: e164, phone_verified_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That number is already in use.', code: 'phone_in_use' }, { status: 409 })
    console.error('[phone/verify] update error:', error)
    return NextResponse.json({ error: 'Could not save your phone.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
