/**
 * GET /api/stripe/connect
 * Initiates Stripe Connect Express onboarding for the authenticated seller (web flow).
 * Creates a Stripe account (if not already created) and redirects to the
 * Stripe-hosted onboarding flow. Native clients use POST /api/stripe/connect/link instead
 * and receive the URL as JSON. Both share lib/stripe-connect.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { appBaseUrl } from '@/lib/stripe'
import { createConnectOnboardingLink } from '@/lib/stripe-connect'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/enter', appBaseUrl()))
  }

  const service = createServiceClientRaw()
  const link = await createConnectOnboardingLink({
    service,
    user,
    refreshUrl: `${appBaseUrl()}/api/stripe/connect`,
    returnUrl: `${appBaseUrl()}/api/stripe/connect/return`,
  })
  if (!link.ok) return NextResponse.redirect(new URL('/onboarding/verify?required=payout', appBaseUrl()))
  return NextResponse.redirect(link.url)
}
