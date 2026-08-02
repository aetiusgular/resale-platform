/**
 * Cross-instance fixed-window rate limiter — pg-backed (security PA).
 *
 * The atomic increment lives in the check_rate_limit RPC (migration 0033) so the limit holds
 * across all serverless instances (the old in-memory counter was per-instance, so the real
 * limit was N × instance_count). The RPC returns the post-increment count + window start; the
 * allowed/remaining/retry decision is computed here in pure JS (rateLimitDecision, unit-tested).
 *
 * FAIL-OPEN: a DB error allows the request (availability over perfect enforcement — the limiter
 * is defense-in-depth, and a hard-fail would lock everyone out on a transient blip).
 */
import { createServiceClientRaw } from '@/lib/supabase/service'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * PURE fixed-window decision from a post-increment count. Mirrors what the SQL RPC increments;
 * kept in JS so it is unit-testable and the retry hint uses the app clock.
 */
export function rateLimitDecision(
  count: number,
  limit: number,
  windowStartMs: number,
  windowMs: number,
  nowMs: number,
): RateLimitResult {
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(0, Math.ceil((windowStartMs + windowMs - nowMs) / 1000)),
  }
}

/**
 * Check + increment a shared rate-limit counter.
 * @param key       unique bucket id, e.g. `checkout:${userId}` / `phone_start:${userId}`
 * @param limit     max requests per window
 * @param windowMs  window duration in ms
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000))
  try {
    const service = createServiceClientRaw()
    const { data, error } = await service.rpc('check_rate_limit', { p_key: key, p_window_seconds: windowSeconds })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as { hit_count?: number; window_start_ms?: number } | null
    if (!row || typeof row.hit_count !== 'number') throw new Error('rate-limit RPC returned no row')
    const windowStartMs = typeof row.window_start_ms === 'number'
      ? row.window_start_ms
      : Math.floor(Date.now() / windowMs) * windowMs
    return rateLimitDecision(row.hit_count, limit, windowStartMs, windowMs, Date.now())
  } catch (err) {
    console.warn('[rate-limit] pg check failed (fail-open):', err)
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }
}
