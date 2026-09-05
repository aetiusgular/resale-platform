/**
 * POST /api/stripe/connect/link — Stripe Connect Express onboarding for native clients.
 * Same account provisioning and payout gate as GET /api/stripe/connect (lib/stripe-connect), but
 * answers `{ url }` instead of redirecting. The app opens `url` in an ASWebAuthenticationSession;
 * Stripe requires https return/refresh URLs, so both point back here with `client=ios` and
 * 302 into the `archive://` scheme the session is waiting for.
 *   403 { code: 'verification_required' } when the ID-verification payout gate applies.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { appBaseUrl } from '@/lib/stripe'
import { createConnectOnboardingLink } from '@/lib/stripe-connect'
import { ApiError, enforceRateLimit, respond } from '@/lib/api/respond'

export async function POST(_request: NextRequest) {
  return respond(async () => {
    const { user } = await requireUser()
    await enforceRateLimit(`connect_link:${user.id}`, 5, 60_000)
    const link = await createConnectOnboardingLink({
      service: createServiceClientRaw(),
      user,
      refreshUrl: `${appBaseUrl()}/api/stripe/connect/refresh?client=ios`,
      returnUrl: `${appBaseUrl()}/api/stripe/connect/return?client=ios`,
    })
    if (!link.ok) throw new ApiError(403, 'Identity verification is required before payouts can be set up.', 'verification_required')
    return { url: link.url }
  })
}
