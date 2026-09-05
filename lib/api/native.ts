/**
 * Native-client conventions shared by the API routes.
 *
 *  - `archive://` is the custom URL scheme registered by archive-ios (CFBundleURLTypes) and, later,
 *    archive-android. Hosted third-party flows (Stripe Connect, Stripe Identity) require https
 *    return URLs, so they come back to an /api route with `?client=ios` that 302s into the scheme.
 *  - `X-Client: ios/<build>` identifies the caller for logs and the force-upgrade gate
 *    (GET /api/mobile/config → minBuild).
 */
import type { NextRequest } from 'next/server'

export const NATIVE_SCHEME = 'archive'

/** `archive://<path>?<query>` */
export function nativeDeepLink(path: string, query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : ''
  return `${NATIVE_SCHEME}://${path.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`
}

export type NativeClient = { platform: 'ios' | 'android'; build: number } | null

/** Parses `X-Client: ios/123`; null for browsers and malformed values. */
export function nativeClient(request: NextRequest | Request): NativeClient {
  const raw = request.headers.get('x-client')
  if (!raw) return null
  const m = /^(ios|android)\/(\d{1,9})$/i.exec(raw.trim())
  if (!m) return null
  return { platform: m[1].toLowerCase() as 'ios' | 'android', build: parseInt(m[2], 10) }
}

/** Minimum app builds still allowed to talk to this API. Bump when a breaking change ships. */
export const MIN_BUILD: Record<'ios' | 'android', number> = {
  ios: parseInt(process.env.MOBILE_MIN_BUILD_IOS ?? '1', 10) || 1,
  android: parseInt(process.env.MOBILE_MIN_BUILD_ANDROID ?? '1', 10) || 1,
}
