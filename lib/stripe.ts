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
  apiVersion: '2026-06-24.dahlia',
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

/**
 * Create the ONE escrow-release transfer for an order — the single shared money
 * path for every release site (buyer confirm, cron retry, dispute resolution,
 * collusion-hold release).
 *
 * Idempotency (code-review fix #2): the per-order `idempotencyKey` makes Stripe
 * dedupe concurrent/retried creates — the classic double-payout windows (deliver
 * racing the cron sweep; a transfer that succeeded but whose stripe_transfer_id
 * stamp failed being retried) all collapse to one real transfer. For the key to
 * work the request params MUST be identical at every call site, which is exactly
 * why this helper exists: do NOT add per-caller metadata/description here — who
 * initiated the release is already audited in order_events / moderation_actions.
 */
export async function createOrderTransfer(
  orderId: string,
  amountCents: number,
  destinationAccountId: string,
): Promise<Stripe.Transfer> {
  return stripe.transfers.create(
    {
      amount:      amountCents,
      currency:    'usd',
      destination: destinationAccountId,
      description: `Order ${orderId} — escrow release`,
      metadata:    { order_id: orderId },
    },
    { idempotencyKey: `transfer-${orderId}` },
  )
}
