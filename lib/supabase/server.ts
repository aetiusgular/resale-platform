import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * Request-scoped Supabase clients.
 *
 * Two kinds of callers reach the API:
 *  - the browser, which carries the @supabase/ssr cookie session (sb-<ref>-auth-token…), and
 *  - native apps (archive-ios, archive-android), which send `Authorization: Bearer <access token>`.
 *
 * `createClient()` serves both without the route knowing which one it is. With a bearer, the
 * client is built with the ANON key plus a global Authorization header: RLS evaluates auth.uid()
 * from the token, and `supabase.auth.getUser()` validates it against GoTrue with a server round
 * trip (supabase-js honours a custom Authorization header for getUser()). Without a bearer, the
 * cookie client below is returned unchanged. The 79 route prologues that call
 * `createClient()` + `getUser()` therefore work for both clients with no edits.
 *
 * Cron/secret-protected routes must keep using createServiceClientRaw(): calling createClient()
 * there would forward `Authorization: Bearer <CRON_SECRET>` to Supabase as if it were a user JWT.
 *
 * Returns a typed SupabaseClient. The Database generic can't be threaded through
 * @supabase/ssr with moduleResolution:"bundler" (dist path issue). Use the
 * Tables<>/Enums<> helpers from ./types for explicit type assertions at call sites.
 */

// RFC 6750 bearer token: base64url segments joined by dots (a JWT), optional padding.
const BEARER_RE = /^Bearer\s+([A-Za-z0-9\-_.~+/]+=*)$/i

/** Extracts the token from an `Authorization` header value, or null when absent/malformed. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null
  const m = BEARER_RE.exec(header.trim())
  return m ? m[1] : null
}

/** The bearer token on the current request, if any. Never throws (no request scope → null). */
export async function bearerFromRequest(): Promise<string | null> {
  try {
    const h = await headers()
    return parseBearer(h.get('authorization'))
  } catch {
    return null
  }
}

/**
 * Anon-key client that authenticates every call with the caller's access token. No session
 * persistence, no refresh: the native client owns its session lifecycle and refreshes before
 * calling. An expired or foreign token makes getUser() return null → routes answer 401.
 */
export function createBearerClient(accessToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  )
}

async function createCookieClient() {
  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component — ignored
          }
        },
      },
    },
  )
}

export async function createClient() {
  const bearer = await bearerFromRequest()
  if (bearer) return createBearerClient(bearer)
  return createCookieClient()
}

export class UnauthorizedError extends Error {
  readonly status = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * The prologue every authenticated route repeats, as one call. Throws UnauthorizedError when
 * there is no valid session; new routes convert it with `jsonError()` from lib/api/respond.
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new UnauthorizedError()
  return { supabase, user }
}

export async function createServiceClient() {
  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // service client never sets cookies
        },
      },
    },
  )
}
