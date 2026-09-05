/**
 * GET /api/stripe/connect/return
 * Stripe sends the seller here after the Express onboarding flow completes.
 *
 * We do NOT trust the redirect itself: the signed-in user's own connected account (from
 * their profile, never a query param) is retrieved from Stripe and synced with the same
 * code path as the `account.updated` webhook (lib/stripe-connect-sync.ts). The webhook stays
 * the canonical stream; this makes payouts_enabled correct the moment the seller is back,
 * and keeps working if the Connect webhook endpoint is missing or its event is delayed.
 * Every failure still redirects to settings (payouts page shows the pending state).
 *
 * Native clients (`?client=ios`) open this URL inside their auth session, which may carry no
 * web cookie: the sync runs when the session can be resolved (cookie or bearer), and the
 * deep link reports `complete` or `pending` either way.
 */
import { NextRequest, NextResponse } from 'next/server'
import stripe, { appBaseUrl } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { syncConnectAccount } from '@/lib/stripe-connect-sync'
import { nativeDeepLink } from '@/lib/api/native'

export const dynamic = 'force-dynamic'

async function syncViewerAccount(): Promise<'complete' | 'pending' | 'anonymous'> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'anonymous'
  try {
    const service = createServiceClientRaw()
    const { data: profile } = await service
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single()
    const accountId = (profile as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id
    if (!accountId) return 'pending'
    const account = await stripe.accounts.retrieve(accountId)
    const { payoutsEnabled } = await syncConnectAccount(account, service)
    return payoutsEnabled ? 'complete' : 'pending'
  } catch (err) {
    // Fail-soft: the account.updated webhook remains the fallback path.
    console.error('[stripe/connect/return] account sync failed:', err)
    return 'pending'
  }
}

export async function GET(request: NextRequest) {
  const status = await syncViewerAccount()

  if (request.nextUrl.searchParams.get('client') === 'ios') {
    return NextResponse.redirect(
      nativeDeepLink('stripe/connect/return', { onboarding: status === 'complete' ? 'complete' : 'pending' }),
    )
  }
  if (status === 'anonymous') return NextResponse.redirect(new URL('/enter/login', appBaseUrl()))
  return NextResponse.redirect(new URL(`/settings/payouts?onboarding=${status}`, appBaseUrl()))
}
