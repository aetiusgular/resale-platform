/**
 * GET /api/stripe/connect
 * Initiates Stripe Connect Express onboarding for the authenticated seller.
 * Creates a Stripe account (if not already created) and redirects to the
 * Stripe-hosted onboarding flow.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe, { appBaseUrl } from '@/lib/stripe'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/enter', appBaseUrl()))
  }

  const service = createServiceClientRaw()

  // Fetch or create the Stripe Connect account ID for this seller
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_connect_account_id, username')
    .eq('id', user.id)
    .single()

  let connectAccountId = profile?.stripe_connect_account_id

  if (!connectAccountId) {
    // Create a new Stripe Express account
    const account = await stripe.accounts.create({
      type:    'express',
      email:   user.email,
      metadata: { user_id: user.id, username: profile?.username ?? '' },
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
    refresh_url: `${appBaseUrl()}/api/stripe/connect`,
    return_url:  `${appBaseUrl()}/api/stripe/connect/return`,
    type:        'account_onboarding',
  })

  return NextResponse.redirect(accountLink.url)
}
