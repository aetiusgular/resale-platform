/**
 * GET /api/auth/callback — OAuth (Google) return handler. Exchanges the authorization `code`
 * for a session, then routes: a user who already has a profile goes to `next`; a brand-new
 * user (no profile) goes to onboarding to choose a username (carrying the invite `code`, if
 * any, as ?code=). The middleware skips /api, so this runs without redirect interference.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const oauthCode = searchParams.get('code')
  const invite = searchParams.get('invite')
  const next = searchParams.get('next') || '/browse'

  if (!oauthCode) {
    return NextResponse.redirect(new URL('/enter/login?error=oauth', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(oauthCode)
  if (error) {
    console.error('[auth/callback] exchange failed:', error.message)
    return NextResponse.redirect(new URL('/enter/login?error=oauth', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/enter/login?error=oauth', origin))
  }

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    const dest = invite ? `/onboarding/account?code=${encodeURIComponent(invite)}` : '/onboarding/account'
    return NextResponse.redirect(new URL(dest, origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
