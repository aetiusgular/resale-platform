/**
 * GET /api/idv/return?client=ios — Stripe Identity's https return URL for native clients;
 * 302s into the `archive://` scheme the app's auth session is waiting for. Web flows return to
 * /onboarding/verify directly and never hit this route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { nativeDeepLink } from '@/lib/api/native'

const appBase = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  if (sp.get('client') === 'ios') {
    return NextResponse.redirect(nativeDeepLink('idv/return', { submitted: '1' }))
  }
  return NextResponse.redirect(new URL('/onboarding/verify?submitted=1', appBase()))
}
