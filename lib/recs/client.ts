/**
 * recs-engine client — SERVER ONLY (holds the feed bearer token).
 * Every call is FAIL-SOFT: on disabled/misconfigured/unreachable/non-2xx it
 * returns null|false so callers fall back to the platform's default behavior
 * (e.g. default listing order). Never throws to the caller.
 */
import { recsConfig, feedReady, ingestReady } from './config'
import { bodySignature } from './hmac'
import type { FeedResponse, AestheticsResponse, ListingChange } from './types'

export { userKeyFor } from './keys'

const TIMEOUT_MS = 1500

async function timedFetch(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } catch {
    return null // network error / timeout → fail soft
  } finally {
    clearTimeout(timer)
  }
}

function feedHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${recsConfig.feedToken}`, 'Content-Type': 'application/json' }
}

/** GET /v1/feed — null on any failure (caller renders default order). */
export async function getFeed(opts: {
  userId?: string | null
  deviceId?: string
  cursor?: string
}): Promise<FeedResponse | null> {
  if (!feedReady()) return null
  const qs = new URLSearchParams()
  if (opts.userId) qs.set('user_id', opts.userId)
  if (opts.deviceId) qs.set('device_id', opts.deviceId)
  if (opts.cursor) qs.set('cursor', opts.cursor)
  const res = await timedFetch(`${recsConfig.feedUrl}/v1/feed?${qs.toString()}`, {
    headers: feedHeaders(),
  })
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as FeedResponse
  } catch {
    return null
  }
}

/** GET /v1/aesthetics — null on failure (caller skips the aesthetic picker). */
export async function getAesthetics(): Promise<AestheticsResponse | null> {
  if (!feedReady()) return null
  const res = await timedFetch(`${recsConfig.feedUrl}/v1/aesthetics`, { headers: feedHeaders() })
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as AestheticsResponse
  } catch {
    return null
  }
}

/** POST /v1/users/{user_key}/seed — true on 204. */
export async function seedUser(userKey: string, aesthetics: string[]): Promise<boolean> {
  if (!feedReady()) return false
  const res = await timedFetch(
    `${recsConfig.feedUrl}/v1/users/${encodeURIComponent(userKey)}/seed`,
    { method: 'POST', headers: feedHeaders(), body: JSON.stringify({ aesthetics }) },
  )
  return !!res && res.ok
}

/** POST /v1/identity/merge — fold an anonymous device profile into an account. */
export async function mergeIdentity(deviceKey: string, accountKey: string): Promise<boolean> {
  if (!feedReady()) return false
  const res = await timedFetch(`${recsConfig.feedUrl}/v1/identity/merge`, {
    method: 'POST',
    headers: feedHeaders(),
    body: JSON.stringify({ device_key: deviceKey, account_key: accountKey }),
  })
  return !!res && res.ok
}

/**
 * POST a listing change to the recs-engine `POST /v1/listings` adapter
 * (validates → XADD `listings:changes`). Targets the ingest service. Auth is an
 * HMAC of the exact request body under the ingest secret (X-Signature), matching
 * recs-engine's `expected_body_signature`. The secret stays server-side.
 * Fail-soft: sync failures never block the platform's own listing write.
 */
export async function postListingChange(change: ListingChange): Promise<boolean> {
  if (!ingestReady()) return false
  const body = JSON.stringify(change)
  const res = await timedFetch(`${recsConfig.ingestUrl}/v1/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': bodySignature(body, recsConfig.ingestSecret),
    },
    body,
  })
  return !!res && res.ok
}
