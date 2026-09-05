/**
 * GET /api/stripe/connect/refresh?client=ios
 * Stripe sends the browser here when a native client's account link expired. The web flow
 * refreshes by hitting /api/stripe/connect again (cookie session); an ASWebAuthenticationSession
 * has no session of its own, so we hand control back to the app, which requests a fresh link.
 */
import { NextRequest, NextResponse } from 'next/server'
import { appBaseUrl } from '@/lib/stripe'
import { nativeDeepLink } from '@/lib/api/native'

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('client') === 'ios') {
    return NextResponse.redirect(nativeDeepLink('stripe/connect/refresh'))
  }
  return NextResponse.redirect(new URL('/api/stripe/connect', appBaseUrl()))
}
