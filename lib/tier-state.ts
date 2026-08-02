/**
 * Stateful tier lock — PURE logic (no I/O), so it is unit-testable in isolation.
 *
 * v2 moves tiering from stateless (recompute the rate at every checkout) to
 * stateful: once a user reaches a better (lower-bps) tier, that rate is LOCKED
 * for TIER_LOCK_DAYS even if their rolling activity later drops. The lock only
 * ever helps the user — a still-active lock floors the rate at the better of
 * (current activity rate, locked rate); an improvement re-locks for a fresh
 * window; expiry degrades back to the pure activity rate.
 */

export const TIER_LOCK_DAYS = 30
export const TIER_LOCK_MS = TIER_LOCK_DAYS * 24 * 60 * 60 * 1000

/**
 * Effective rate to charge = the better (LOWER bps) of the current activity rate
 * and a still-active lock. An expired / absent lock is ignored.
 */
export function effectiveTierBps(
  activityBps: number,
  lockedBps: number | null,
  lockedUntilMs: number | null,
  nowMs: number,
): number {
  if (lockedBps != null && lockedUntilMs != null && nowMs < lockedUntilMs) {
    return Math.min(activityBps, lockedBps)
  }
  return activityBps
}

/**
 * Does a freshly-computed activity rate strictly UPGRADE the stored tier (lower
 * bps, or first-ever)? Pure helper — kept for callers/tests that want a plain
 * "is this better" check. The order-completion updater uses shouldRefreshLock
 * (below), which is lock-expiry aware.
 */
export function isUpgrade(newActivityBps: number, currentStoredBps: number | null): boolean {
  return currentStoredBps == null || newActivityBps < currentStoredBps
}

/**
 * ORDER-COMPLETION decision: should we (re)write the stored tier and reset the
 * 30-day lock? When true, the caller persists bps = activityBps, until = now+30d.
 *
 *   - No active lock (expired or absent) → YES. Re-lock the CURRENT activity tier
 *     fresh. This also clears a stale better bps from a long-expired lock, so a
 *     later genuine re-earn locks correctly (fixes the "elite once, never
 *     re-locks" gap).
 *   - Active lock, activity at least as good (≤ stored bps) → YES. Refreshes a
 *     genuinely maintained/improved tier for a rolling 30 days.
 *   - Active lock, activity WORSE than the locked tier → NO. Grace continues to
 *     its original expiry but is NOT extended — you cannot keep a one-time high
 *     tier alive forever with trivial sales.
 */
export function shouldRefreshLock(
  activityBps: number,
  storedBps: number | null,
  storedUntilMs: number | null,
  nowMs: number,
): boolean {
  const lockActive = storedUntilMs != null && nowMs < storedUntilMs
  if (!lockActive) return true
  if (storedBps == null) return true
  return activityBps <= storedBps
}
