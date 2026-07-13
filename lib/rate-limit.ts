/**
 * In-memory sliding-window rate limiter.
 *
 * Tradeoff vs. pg-based counter:
 *   - In-memory: zero DB latency, but counters reset on process restart and are
 *     not shared between Vercel serverless function instances. On multi-instance
 *     deployments a client could make N requests per instance, so effective limit
 *     is N × instance_count. Suitable for alpha (low traffic, single region).
 *   - pg-based: accurate across all instances, but adds a DB round-trip on every
 *     rate-limited request. Prefer pg-based at scale; switch in B9/PA.
 *
 * Each counter bucket is keyed by `${key}:${windowStart}` where windowStart is
 * floored to the window duration. Buckets older than 2× the window are evicted.
 */

interface Bucket {
  count: number
  windowStart: number
}

// Global map — persists for the lifetime of the process (single function instance)
const counters = new Map<string, Bucket>()

// Evict stale buckets every 5 minutes to prevent memory growth
let lastEvict = Date.now()
function maybeEvict(windowMs: number) {
  const now = Date.now()
  if (now - lastEvict < 5 * 60 * 1000) return
  lastEvict = now
  const cutoff = now - 2 * windowMs
  for (const [k, b] of counters) {
    if (b.windowStart < cutoff) counters.delete(k)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Check and increment a rate limit counter.
 * @param key       Unique identifier for the limit (e.g. `auth:${ip}`, `checkout:${userId}`)
 * @param limit     Maximum requests allowed per window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  maybeEvict(windowMs)

  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucketKey = `${key}:${windowStart}`

  const bucket = counters.get(bucketKey) ?? { count: 0, windowStart }
  bucket.count += 1
  counters.set(bucketKey, bucket)

  const allowed = bucket.count <= limit
  const remaining = Math.max(0, limit - bucket.count)
  const retryAfterSeconds = Math.ceil((windowStart + windowMs - now) / 1000)

  return { allowed, remaining, retryAfterSeconds }
}
