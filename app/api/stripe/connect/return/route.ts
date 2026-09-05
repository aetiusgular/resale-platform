/**
 * GET /api/stripe/connect/return
 * Called by Stripe after the Express onboarding flow completes. Nothing is verified here on
 * purpose: the canonical payouts_enabled update is done by the account.updated webhook.
 * This route just redirects the user back to their settings page — or, for a native client
 * (`?client=ios`), into the `archive://` scheme its auth session is waiting for.
 */
import { NextRequest, NextResponse } from 'next/server'
import { appBaseUrl } from '@/lib/stripe'
import { nativeDeepLink } from '@/lib/api/native'

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('client') === 'ios') {
    return NextResponse.redirect(nativeDeepLink('stripe/connect/return', { onboarding: 'complete' }))
  }
  // The account.updated webhook will fire asynchronously and update payouts_enabled.
  // Redirect to settings with a query param so the UI can show a pending message.
  return NextResponse.redirect(
    new URL('/settings/payouts?onboarding=complete', appBaseUrl()),
  )
}
