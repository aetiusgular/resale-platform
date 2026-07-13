import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible without a session
const PUBLIC_PATHS = ['/enter', '/enter/waitlist', '/onboarding/account', '/styleguide']

// Routes only accessible without a session (redirect to / if logged in)
const AUTH_ONLY_PATHS = ['/enter', '/enter/waitlist']

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
    // No session → redirect everything to /enter
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

  // Check if user has a profile + claimed invite code
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, invited_by, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // No profile yet — send to onboarding/account
    return NextResponse.redirect(new URL('/onboarding/account', request.url))
  }

  // Has profile but no invite code claimed and not admin → must claim a code first
  if (!profile.invited_by && profile.role !== 'admin') {
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/enter', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
