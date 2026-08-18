/**
 * Stripe Identity adapter — SERVER ONLY. Replaces Persona as the ID-verification provider
 * for the INFORM-Act high-volume seller gate. The policy/logic (lib/idv/verification-policy.ts,
 * lib/idv/risk-resolver.ts, the $5k trigger) is UNCHANGED — only the provider swaps.
 *
 *  1. Create a hosted VerificationSession the seller is sent to; metadata.user_id ties the
 *     resulting session back to our user.
 *  2. Interpret identity.verification_session.* webhook events. The webhook SIGNATURE is
 *     verified by the shared Stripe webhook (constructWebhookEvent) — no separate secret here.
 *
 * Behind VERIFICATION_ENABLED at the call sites; unconfigured ⇒ inert.
 */
import type Stripe from 'stripe'
import stripe from '@/lib/stripe'

/** Stripe Identity is usable whenever the Stripe secret key is configured. */
export function stripeIdentityConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Create a hosted Identity VerificationSession for a user. Returns { url, id } or null when
 * unconfigured / no hosted URL was issued. `return_url` is where Stripe sends the user back.
 */
export async function createIdentitySession(
  userId: string,
  returnUrl?: string,
): Promise<{ url: string; id: string } | null> {
  if (!stripeIdentityConfigured()) return null
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { user_id: userId },
    ...(returnUrl ? { return_url: returnUrl } : {}),
  })
  if (!session.url) return null
  return { url: session.url, id: session.id }
}

export type IdentityEvent = {
  eventId: string
  eventName: string
  sessionId: string | null
  userId: string | null
  status: string | null
}

/** Pull the fields we need out of an identity.verification_session.* event. */
export function parseIdentityEvent(event: Stripe.Event): IdentityEvent {
  const session = event.data.object as Stripe.Identity.VerificationSession
  return {
    eventId: event.id,
    eventName: event.type,
    sessionId: session.id ?? null,
    userId: (session.metadata?.user_id as string | undefined) ?? null,
    status: session.status ?? null,
  }
}

/** Did this event mean the seller PASSED verification? */
export function isIdentityApproval(ev: IdentityEvent): boolean {
  return ev.eventName === 'identity.verification_session.verified' || ev.status === 'verified'
}

/** Did this event mean verification was canceled / abandoned? */
export function isIdentityDecline(ev: IdentityEvent): boolean {
  return ev.eventName === 'identity.verification_session.canceled' || ev.status === 'canceled'
}
