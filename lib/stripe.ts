/**
 * Stripe server-side singleton and helpers.
 * Import this only in server-side code (route handlers, server components).
 * NEVER import in client components — it would expose STRIPE_SECRET_KEY.
 */
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
  typescript: true,
})

export default stripe

/**
 * Verify a Stripe webhook signature and parse the event.
 * Throws StripeSignatureVerificationError on failure.
 * Raw body (string) must be passed — do NOT parse with JSON.parse first.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
}

/**
 * Returns the base URL for Stripe Connect redirect URLs.
 * Uses NEXT_PUBLIC_APP_URL if set, otherwise localhost:3000.
 */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
