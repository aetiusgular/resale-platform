/**
 * Stripe Connect Express onboarding link — shared by GET /api/stripe/connect (web redirect) and
 * POST /api/stripe/connect/link (native clients receive `{url}` and open it in an auth session).
 * SERVER ONLY. Creates the Express account on first use and persists its id immediately (never
 * waits for account.updated); `payouts_enabled` is written by the account.updated webhook and by
 * /api/stripe/connect/return, both through lib/stripe-connect-sync.
 */
import type { User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'
import { sellerOrigin } from '@/lib/listings/origin'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export type ConnectLinkResult =
  | { ok: true; url: string }
  /** Payout gate (behind VERIFICATION_ENABLED): ID verification must complete first. */
  | { ok: false; reason: 'verification_required' }
  /** Stripe can't open a payout account in the seller's country (cross-border payouts). */
  | { ok: false; reason: 'country_unsupported'; country: string }

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
    // Create a new Stripe Express account in the seller's country (their default address;
    // US when none). A seller outside the US gets the `recipient` service agreement: the
    // platform keeps charging buyers in the US and transfers payouts cross-border, which
    // Stripe requires for transfers-only accounts abroad. The platform must have
    // cross-border payouts enabled in the Stripe dashboard for this to succeed.
    const country = await sellerOrigin(service, user.id)
    let account
    try {
      account = await stripe.accounts.create({
      type:    'express',
      email:   user.email,
      country,
      ...(country !== 'US' ? { tos_acceptance: { service_agreement: 'recipient' as const } } : {}),
      // Separate charges & transfers: the platform charges the buyer, then transfers the
      // payout (lib/stripe createOrderTransfer). The connected account only needs the
      // `transfers` capability; request it explicitly rather than relying on the Connect
      // dashboard's default-capabilities setting.
      capabilities: { transfers: { requested: true } },
      metadata: { user_id: user.id, username: (profile?.username as string | undefined) ?? '' },
      })
    } catch (e) {
      // Outside the US the account only works where Stripe supports cross-border payouts.
      if (country !== 'US') {
        console.warn(`[connect] account create refused for ${country}:`, e)
        return { ok: false, reason: 'country_unsupported', country }
      }
      throw e
    }
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
