/**
 * Stateful tier resolver + updater — SERVER ONLY.
 *
 * Bridges the pure lock logic (lib/tier-state.ts) to persisted per-side tier
 * state on `profiles`:
 *   - resolveEffectiveBps  → CHECKOUT: the effective bps to charge (current
 *     activity rate, floored by a still-active 30-day lock). Snapshot the return
 *     value exactly as before — the snapshot keeps historical orders immutable.
 *   - applyTierProgress    → ORDER COMPLETION (released): recompute activity and,
 *     if it UPGRADES the stored tier, persist the better rate + a fresh 30-day
 *     lock. Idempotent (only writes on a strict improvement), so it is safe to
 *     call from both release paths (the deliver route and the transfer cron).
 *
 * Never import into a client component (uses the service-role client).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { trailingActivity, type FeeSide } from '@/lib/fee-tier'
import { feeBpsForActivity } from '@/lib/fees'
import { effectiveTierBps, shouldRefreshLock, TIER_LOCK_MS } from '@/lib/tier-state'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

const COL = {
  buyer:  { bps: 'current_buyer_tier_bps',  until: 'buyer_tier_locked_until' },
  seller: { bps: 'current_seller_tier_bps', until: 'seller_tier_locked_until' },
} as const

/**
 * CHECKOUT rate: the effective bps to charge a user on the given side — the
 * current trailing-activity rate, floored by a still-active lock (a lock only
 * ever helps the user). FAIL-SAFE: on any error, falls back to the pure activity
 * rate (never a better rate by accident).
 */
export async function resolveEffectiveBps(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number> {
  const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
  const activityBps = feeBpsForActivity(volumeCents, orderCount)
  try {
    const { data } = await service
      .from('profiles')
      .select(`${COL[side].bps}, ${COL[side].until}`)
      .eq('id', userId)
      .single()
    const row = (data ?? null) as Record<string, unknown> | null
    const lockedBps = (row?.[COL[side].bps] as number | null) ?? null
    const untilRaw = row?.[COL[side].until] as string | null | undefined
    const lockedUntilMs = untilRaw ? Date.parse(untilRaw) : null
    return effectiveTierBps(activityBps, lockedBps, lockedUntilMs, Date.now())
  } catch (err) {
    console.error(`[tier-progress] lock lookup failed for ${side} ${userId}; using activity`, err)
    return activityBps
  }
}

/**
 * ORDER COMPLETION: recompute the user's activity rate on the given side and,
 * per shouldRefreshLock, persist the current activity tier + a fresh 30-day lock.
 * Rolling grace: maintaining/improving a tier refreshes it; an active better lock
 * is never extended by worse activity (no gaming); a dropped-then-re-earned tier
 * re-locks correctly. Idempotent enough for both release paths — it recomputes
 * from scratch, so double calls converge (only a benign last-writer-wins on the
 * lock's timestamp).
 */
export async function applyTierProgress(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<void> {
  try {
    const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
    const activityBps = feeBpsForActivity(volumeCents, orderCount)
    const { data } = await service
      .from('profiles')
      .select(`${COL[side].bps}, ${COL[side].until}`)
      .eq('id', userId)
      .single()
    const row = (data ?? null) as Record<string, unknown> | null
    const storedBps = (row?.[COL[side].bps] as number | null) ?? null
    const untilRaw = row?.[COL[side].until] as string | null | undefined
    const storedUntilMs = untilRaw ? Date.parse(untilRaw) : null
    if (shouldRefreshLock(activityBps, storedBps, storedUntilMs, Date.now())) {
      await service
        .from('profiles')
        .update({
          [COL[side].bps]: activityBps,
          [COL[side].until]: new Date(Date.now() + TIER_LOCK_MS).toISOString(),
        })
        .eq('id', userId)
    }
  } catch (err) {
    // Non-fatal: a missed tier update must never break order completion / payout.
    console.error(`[tier-progress] update failed for ${side} ${userId}`, err)
  }
}
