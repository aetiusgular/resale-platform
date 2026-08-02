/**
 * Twilio adapters — SERVER ONLY. Lookup Line Type Intelligence (VOIP/burner classification)
 * + Verify (SMS OTP). REST via fetch, HTTP Basic (AccountSid:AuthToken). Env-driven and
 * fail-soft: unconfigured/errored calls return a safe non-blocking result so the app runs
 * without Twilio, and callers decide the fail-open policy on a Lookup outage.
 */
import { isBlockedLineType } from './line'

function basicAuth(): string | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const tok = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !tok) return null
  return 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64')
}

export type LineCheck = { type: string | null; blocked: boolean; ok: boolean }

/** Look up the line type. ok=false when unconfigured or the API errors (caller fail-opens). */
export async function lookupLineType(e164: string): Promise<LineCheck> {
  const auth = basicAuth()
  if (!auth) return { type: null, blocked: false, ok: false }
  try {
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`,
      { headers: { Authorization: auth } },
    )
    if (!res.ok) return { type: null, blocked: false, ok: false }
    const data = (await res.json()) as { line_type_intelligence?: { type?: string } }
    const type = data.line_type_intelligence?.type ?? null
    return { type, blocked: isBlockedLineType(type), ok: true }
  } catch (e) {
    console.warn('[twilio] lookup failed:', e)
    return { type: null, blocked: false, ok: false }
  }
}

export async function sendVerification(e164: string): Promise<boolean> {
  const auth = basicAuth()
  const svc = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!auth || !svc) return false
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${svc}/Verifications`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, Channel: 'sms' }),
    })
    return res.ok
  } catch (e) {
    console.warn('[twilio] send verification failed:', e)
    return false
  }
}

export async function checkVerification(e164: string, code: string): Promise<boolean> {
  const auth = basicAuth()
  const svc = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!auth || !svc) return false
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${svc}/VerificationCheck`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, Code: code }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { status?: string }
    return data.status === 'approved'
  } catch (e) {
    console.warn('[twilio] check verification failed:', e)
    return false
  }
}
