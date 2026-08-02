import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible without a session (listing detail is public read for active listings)
const PUBLIC_PATHS = ['/enter', '/enter/waitlist', '/onboarding/account', '/styleguide', '/listings']

// Routes only accessible without a session (redirect to / if logged in)
const AUTH_ONLY_PATHS = ['/enter', '/enter/waitlist']

// Routes requiring role='admin'
const ADMIN_PATHS = ['/admin']

// Gate cache cookie name and TTL (10 minutes)
const GATE_COOKIE = 'x-gate-ok'
const GATE_TTL_S = 600

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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
      return NextResponse.redirect(new URL('/enter', request.url))
    }
    return response
  }

  // Has session — check for claimed invite code
  // If they're still in onboarding, let them through
  const isOnboarding = pathname.startsWith('/onboarding')
  if (isOnboarding) {
    return response
  }

  // Authenticated users hitting /enter → send to home
  if (AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasGateCookie = request.cookies.has(GATE_COOKIE)

  // Skip profiles query if gate cookie exists AND this is not an admin path
  // (admin paths always need a fresh role check)
  if (hasGateCookie && !isAdminPath) {
    return response
  }

  // Check if user has a profile + claimed invite code
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, invited_by, role, banned')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // No profile yet — send to onboarding/account
    return NextResponse.redirect(new URL('/onboarding/account', request.url))
  }

  // Ban enforcement (G6): a suspended user is redirected to /banned on any page.
  // (API routes are guarded separately via assertNotBanned; the gate cookie may delay
  // page enforcement by up to its TTL for an already-active session — see docs.)
  if (profile.banned && pathname !== '/banned') {
    return NextResponse.redirect(new URL('/banned', request.url))
  }

  // Has profile but no invite code claimed and not admin → must claim a code first
  if (!profile.invited_by && profile.role !== 'admin') {
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/enter', request.url))
    }
    // Don't set gate cookie for ungated users
    return response
  }

  // Admin gate: /admin/* requires role='admin'
  if (isAdminPath) {
    if (profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
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

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
