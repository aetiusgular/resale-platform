/**
 * GET /api/stripe/connect/return
 * Called by Stripe after the Express onboarding flow completes.
 * We verify the account status via API (never trust the redirect alone).
 * The canonical payouts_enabled update is done by the account.updated webhook.
 * This route just redirects the user back to their settings page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { appBaseUrl } from '@/lib/stripe'

export async function GET(_request: NextRequest) {
  // The account.updated webhook will fire asynchronously and update payouts_enabled.
  // Redirect to settings with a query param so the UI can show a pending message.
  return NextResponse.redirect(
    new URL('/settings/payouts?onboarding=complete', appBaseUrl()),
  )
}
