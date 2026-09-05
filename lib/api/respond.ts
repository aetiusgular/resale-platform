// Small response helpers for the route handlers added for native clients. Existing routes keep
// their inline NextResponse.json calls; new routes use these so the error contract stays uniform:
// `{ error: string, code?: string }` with the status conventions documented in docs/api/openapi.yaml.
import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiError(status: number, message: string, code?: string, headers?: Record<string, string>) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status, headers })
}

export const notFound = (message = 'Not found') => apiError(404, message)
export const badRequest = (message: string, code?: string) => apiError(400, message, code)

/** Converts thrown errors into the JSON error contract. Unknown errors are logged and become 500. */
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof UnauthorizedError) return apiError(401, 'Unauthorized')
  if (e instanceof ApiError) return apiError(e.status, e.message, e.code, e.headers)
  console.error('[api] unhandled route error:', e)
  return apiError(500, 'Internal error')
}

/** Throws a 429 ApiError (with Retry-After) when the shared fixed-window counter is exceeded. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const rl = await checkRateLimit(key, limit, windowMs)
  if (!rl.allowed) throw new ApiError(429, 'Too many requests', 'rate_limited', { 'Retry-After': String(rl.retryAfterSeconds) })
}

/** Wraps a handler body so any thrown ApiError/UnauthorizedError becomes the right response. */
export async function respond<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const body = await fn()
    return body instanceof NextResponse ? body : NextResponse.json(body)
  } catch (e) {
    return handleRouteError(e)
  }
}
