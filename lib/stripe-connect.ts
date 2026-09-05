/**
 * Stripe Connect Express onboarding link — shared by GET /api/stripe/connect (web redirect) and
 * POST /api/stripe/connect/link (native clients receive `{url}` and open it in an auth session).
 * SERVER ONLY. Creates the Express account on first use and persists its id immediately (never
 * waits for account.updated); `payouts_enabled` is only ever written by the webhook.
 */
import type { User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export type ConnectLinkResult =
  | { ok: true; url: string }
  /** Payout gate (behind VERIFICATION_ENABLED): ID verification must complete first. */
  | { ok: false; reason: 'verification_required' }

export async function createConnectOnboardingLink(opts: {
  service: ServiceClient
  user: User
  returnUrl: string
  refreshUrl: string
}): Promise<ConnectLinkResult> {
  const { service, user, returnUrl, refreshUrl } = opts

  // Fetch or create the Stripe Connect account ID for this seller
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_connect_account_id, username, id_verification_status')
    .eq('id', user.id)
    .single()

  // Payout gate (behind VERIFICATION_ENABLED): hold Connect onboarding for a risk-
  // flagged or high-volume seller until ID verification is complete.
  if (VERIFICATION_ENABLED) {
    const verified =
      (profile as { id_verification_status?: string } | null)?.id_verification_status === 'verified'
    if (!verified && (await sellerMustVerify(service, user.id))) {
      return { ok: false, reason: 'verification_required' }
    }
  }

  let connectAccountId = profile?.stripe_connect_account_id as string | null | undefined

  if (!connectAccountId) {
    // Create a new Stripe Express account
    const account = await stripe.accounts.create({
      type:    'express',
      email:   user.email,
      metadata: { user_id: user.id, username: (profile?.username as string | undefined) ?? '' },
    })
    connectAccountId = account.id

    // Persist the account ID immediately (don't wait for account.updated webhook)
    await service
      .from('profiles')
      .update({ stripe_connect_account_id: connectAccountId })
      .eq('id', user.id)
  }

  // Create an account link for the onboarding flow
  const accountLink = await stripe.accountLinks.create({
    account:     connectAccountId,
    refresh_url: refreshUrl,
    return_url:  returnUrl,
    type:        'account_onboarding',
  })

  return { ok: true, url: accountLink.url }
}
