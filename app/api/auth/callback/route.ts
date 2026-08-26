/**
 * GET /api/auth/callback — OAuth (Google) return handler. Exchanges the authorization `code`
 * for a session, then routes: a user who already has a profile goes to `next`; a brand-new
 * user (no profile) goes to onboarding to choose a username. The middleware skips /api, so
 * this runs without redirect interference.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Resolve the post-login `next` target to a same-origin path.
 *
 * `new URL(raw, origin)` IGNORES the base whenever `raw` is absolute, so passing a
 * raw search param straight into it is an open redirect: `?next=https://evil.com`,
 * `?next=//evil.com` (protocol-relative) and `?next=/\evil.com` (WHATWG treats `\`
 * as `/` for special schemes) all resolve off-origin. Parsing and then comparing
 * `origin` rejects every one of those, including percent-encoded variants, without
 * hand-rolling string checks. Anything off-origin or unparseable falls back to /browse.
 */
function resolveNext(raw: string | null, origin: string): string {
  if (!raw) return '/browse'
  try {
    const target = new URL(raw, origin)
    if (target.origin !== origin) return '/browse'
    return target.pathname + target.search + target.hash
  } catch {
    return '/browse'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const oauthCode = searchParams.get('code')
  // Supabase/Google can return an error INSTEAD of a code (e.g. an account-linking
  // refusal). That carries the real reason — surface it instead of a generic failure.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  const next = resolveNext(searchParams.get('next'), origin)

  const fail = (reason: string) => {
    console.error('[auth/callback] failed:', reason)
    return NextResponse.redirect(
      new URL(`/enter/login?error=oauth&reason=${encodeURIComponent(reason)}`, origin),
    )
  }

  if (providerError) return fail(providerError)
  if (!oauthCode) return fail('missing authorization code')

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(oauthCode)
  if (error) return fail(error.message)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('no user after code exchange')

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (!profile) {
    return NextResponse.redirect(new URL('/onboarding/account', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
