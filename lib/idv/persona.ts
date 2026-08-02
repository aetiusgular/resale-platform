/**
 * Persona ID-verification adapter — SERVER ONLY. Two responsibilities:
 *  1. Build the hosted-flow URL the seller is sent to (no API key needed to start).
 *  2. Verify the signed webhook + parse the inquiry event. The webhook is the source of
 *     truth for verification status. All config is env-driven; unconfigured ⇒ inert.
 *
 * Signature (docs.withpersona.com/webhooks-best-practices): header `Persona-Signature`
 * = `t=<unix>,v1=<hex hmac>` (space-separated sets during secret rotation). The HMAC is
 * SHA256 of `"{t}.{rawBody}"` with the webhook secret, hex-encoded.
 */
import crypto from 'node:crypto'

export function personaConfigured(): boolean {
  return Boolean(process.env.PERSONA_TEMPLATE_ID)
}

/** Hosted-flow URL for a user, or null when unconfigured. reference-id ties it to the user. */
export function personaHostedUrl(referenceId: string): string | null {
  const template = process.env.PERSONA_TEMPLATE_ID
  if (!template) return null
  const base = process.env.PERSONA_FLOW_BASE_URL ?? 'https://withpersona.com/verify'
  const params = new URLSearchParams()
  params.set('inquiry-template-id', template)
  if (process.env.PERSONA_ENVIRONMENT_ID) params.set('environment-id', process.env.PERSONA_ENVIRONMENT_ID)
  params.set('reference-id', referenceId)
  const redirect = process.env.PERSONA_REDIRECT_URI
    ?? (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/verify?submitted=1` : undefined)
  if (redirect) params.set('redirect-uri', redirect)
  return `${base}?${params.toString()}`
}

/** Constant-time verify of the Persona-Signature header against the raw request body. */
export function verifyPersonaSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false
  for (const set of header.trim().split(/\s+/)) {
    const pairs: Record<string, string> = {}
    for (const kv of set.split(',')) {
      const i = kv.indexOf('=')
      if (i > 0) pairs[kv.slice(0, i)] = kv.slice(i + 1)
    }
    const t = pairs['t']
    const v1 = pairs['v1']
    if (!t || !v1) continue
    const digest = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
    if (v1.length === digest.length && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(digest))) return true
  }
  return false
}

export type PersonaEvent = {
  eventId: string | null
  eventName: string | null
  inquiryId: string | null
  referenceId: string | null
  status: string | null
}

/** Pull the event id/name + inquiry id/reference-id/status out of a webhook body. */
export function parsePersonaEvent(body: unknown): PersonaEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (body as any)?.data
  const inquiry = data?.attributes?.payload?.data
  return {
    eventId: data?.id ?? null,
    eventName: data?.attributes?.name ?? null,
    inquiryId: inquiry?.id ?? null,
    referenceId: inquiry?.attributes?.['reference-id'] ?? null,
    status: inquiry?.attributes?.status ?? null,
  }
}

/** Did this event mean the seller passed verification? */
export function isApproval(ev: PersonaEvent): boolean {
  return ev.eventName === 'inquiry.approved' || ev.status === 'approved'
}
export function isDecline(ev: PersonaEvent): boolean {
  return ev.eventName === 'inquiry.declined' || ev.status === 'declined' || ev.status === 'failed'
}
