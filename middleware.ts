import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible without a session (listing detail is public read for active listings)
const PUBLIC_PATHS = ['/enter', '/onboarding/account', '/styleguide', '/listings']

// Routes only accessible without a session (redirect to / if logged in)
const AUTH_ONLY_PATHS = ['/enter']

// Routes requiring role='admin'
const ADMIN_PATHS = ['/admin']

// Gate cache cookie name and TTL (10 minutes)
const GATE_COOKIE = 'x-gate-ok'
const GATE_TTL_S = 600

/**
 * Per-request Content-Security-Policy with a nonce (security PA). Dropping
 * script-src 'unsafe-inline' is the meaningful XSS hardening: inline scripts now need this
 * nonce (Next.js applies it to its own bootstrap scripts automatically once the CSP is on the
 * request headers), while external scripts stay host-allowlisted (Stripe/PostHog).
 * style-src keeps 'unsafe-inline' — the UI is built on React inline styles (style={{…}}), which
 * nonces can't cover; that is an accepted, lower-risk posture. Set on both request headers (so
 * Next reads the nonce) and the response (so the browser enforces it).
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com https://app.posthog.com${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://q.stripe.com https://b.stripecdn.com https://us.i.posthog.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.stripe.com https://app.posthog.com https://us.i.posthog.com https://*.sentry.io https://o*.ingest.sentry.io`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through Next.js internals and static assets (no HTML, so no nonce/CSP needed)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // ── CSP nonce (per page request) ──────────────────────────────────────────
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)
  const applyCsp = <T extends NextResponse>(r: T): T => {
    r.headers.set('Content-Security-Policy', csp)
    return r
  }
  // Forward the nonce + CSP on the request so Next.js nonces its inline scripts.
  const buildRequestHeaders = () => {
    const h = new Headers(request.headers)
    h.set('x-nonce', nonce)
    h.set('Content-Security-Policy', csp)
    return h
  }

  let response = NextResponse.next({ request: { headers: buildRequestHeaders() } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Rebuild AFTER cookies mutate the request so both the auth cookies and the
          // nonce/CSP headers are forwarded together.
          response = NextResponse.next({ request: { headers: buildRequestHeaders() } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // ALWAYS use getUser() — never getSession() for authz decisions
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user) {
    // No session → redirect everything to /enter; clear stale gate cookie
    if (request.cookies.has(GATE_COOKIE)) {
      response.cookies.delete(GATE_COOKIE)
    }
    if (!isPublicPath) {
      return applyCsp(NextResponse.redirect(new URL('/enter', request.url)))
    }
    return applyCsp(response)
  }

  // Has session — if they're still in onboarding, let them through
  const isOnboarding = pathname.startsWith('/onboarding')
  if (isOnboarding) {
    return applyCsp(response)
  }

  // Authenticated users hitting /enter → send to home
  if (AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return applyCsp(NextResponse.redirect(new URL('/', request.url)))
  }

  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasGateCookie = request.cookies.has(GATE_COOKIE)

  // Skip profiles query if gate cookie exists AND this is not an admin path
  // (admin paths always need a fresh role check)
  if (hasGateCookie && !isAdminPath) {
    return applyCsp(response)
  }

  // Check if user has a profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, banned')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // No profile yet — send to onboarding/account
    return applyCsp(NextResponse.redirect(new URL('/onboarding/account', request.url)))
  }

  // Ban enforcement (G6): a suspended user is redirected to /banned on any page.
  if (profile.banned && pathname !== '/banned') {
    return applyCsp(NextResponse.redirect(new URL('/banned', request.url)))
  }

  // Admin gate: /admin/* requires role='admin'
  if (isAdminPath) {
    if (profile.role !== 'admin') {
      return applyCsp(NextResponse.redirect(new URL('/', request.url)))
    }
  }

  // Gate passed — set short-lived cookie to skip profiles query on next requests
  if (!hasGateCookie) {
    response.cookies.set(GATE_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: GATE_TTL_S,
      path: '/',
    })
  }

  return applyCsp(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
