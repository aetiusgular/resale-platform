# Branch 3 — `feat/stateful-tier-migration` (plan + verified core)

Persist tier state + the **30-day status lock** (upgrades stick for ≥30 days even if rolling
volume drops). Off `feat/fee-volume-cap`. This is the one branch that moves tiering from
**stateless** (recompute at checkout) to **stateful** (stored rate + lock). db-guard +
code-reviewer. The pure lock resolver is cloud-verified (grace / improve / expire).

## 1. Migration — `..._stateful_tiers.sql` (db-guard)
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_buyer_tier_bps   INT,
  ADD COLUMN IF NOT EXISTS current_seller_tier_bps  INT,
  ADD COLUMN IF NOT EXISTS buyer_tier_locked_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_tier_locked_until TIMESTAMPTZ;
-- NULL bps / NULL until = no lock (new users) → resolve purely from activity.
-- Written only by the service role in the order-completion updater; no client write policy.
```
(These are your `current_buyer_tier` / `..._locked_until` fields; I store the resolved **bps**
directly so the checkout resolver needs no tier→rate lookup. Swap to a tier *index* if you'd
rather — just map through FEE_TIERS in the resolver.)

## 2. Pure lock resolver — `lib/tier-state.ts` (VERIFIED, ship as-is)
```ts
export const TIER_LOCK_DAYS = 30
export const TIER_LOCK_MS = TIER_LOCK_DAYS * 24 * 60 * 60 * 1000

/** Effective rate = better (LOWER bps) of the current activity rate and a still-active lock. */
export function effectiveTierBps(
  activityBps: number, lockedBps: number | null, lockedUntilMs: number | null, nowMs: number,
): number {
  if (lockedBps != null && lockedUntilMs != null && nowMs < lockedUntilMs) {
    return Math.min(activityBps, lockedBps)
  }
  return activityBps
}

/** Does a freshly-computed activity rate UPGRADE the stored tier (→ relock 30 days)? */
export function isUpgrade(newActivityBps: number, currentStoredBps: number | null): boolean {
  return currentStoredBps == null || newActivityBps < currentStoredBps
}
```
Verified: no lock → activity; worse activity during lock → keep locked (grace); better activity
during lock → the better rate wins; expired → degrade to activity.

## 3. Server updater + resolver — `lib/tier-progress.ts` (on-computer draft; reads/writes profiles)
```ts
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { trailingActivity, type FeeSide } from '@/lib/fee-tier'
import { feeBpsForActivity } from '@/lib/fees'
import { effectiveTierBps, isUpgrade, TIER_LOCK_MS } from '@/lib/tier-state'

type ServiceClient = ReturnType<typeof createServiceClientRaw>
const COL = {
  buyer:  { bps: 'current_buyer_tier_bps',  until: 'buyer_tier_locked_until' },
  seller: { bps: 'current_seller_tier_bps', until: 'seller_tier_locked_until' },
} as const

/** Checkout: the EFFECTIVE bps to charge (activity, floored by a still-active lock). */
export async function resolveEffectiveBps(service: ServiceClient, userId: string, side: FeeSide) {
  const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
  const activityBps = feeBpsForActivity(volumeCents, orderCount)
  const { data } = await service.from('profiles')
    .select(`${COL[side].bps}, ${COL[side].until}`).eq('id', userId).single()
  const lockedBps = (data?.[COL[side].bps] as number | null) ?? null
  const until = data?.[COL[side].until] ? Date.parse(data[COL[side].until] as string) : null
  return effectiveTierBps(activityBps, lockedBps, until, Date.now())
}

/** Order completion: upgrade + relock 30 days when the activity rate improves. */
export async function applyTierProgress(service: ServiceClient, userId: string, side: FeeSide) {
  const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
  const activityBps = feeBpsForActivity(volumeCents, orderCount)
  const { data } = await service.from('profiles').select(`${COL[side].bps}`).eq('id', userId).single()
  const currentBps = (data?.[COL[side].bps] as number | null) ?? null
  if (isUpgrade(activityBps, currentBps)) {
    await service.from('profiles').update({
      [COL[side].bps]: activityBps,
      [COL[side].until]: new Date(Date.now() + TIER_LOCK_MS).toISOString(),
    }).eq('id', userId)
  }
}
```

## 4. Wiring (2 call sites)
- **Checkout** (`app/api/checkout/route.ts`): swap the two `feeBpsForUser(...)` calls for
  `resolveEffectiveBps(service, buyerId,'buyer')` / `(sellerId,'seller')`. Snapshot the returned
  bps exactly as today — the snapshot still makes historical orders immutable.
- **Order completion** (the `released` transition — stripe webhook / auto-release path): call
  `applyTierProgress(service, buyerId,'buyer')` **and** `(sellerId,'seller')` so a completed sale
  upgrades + locks both parties. Idempotent (only upgrades on strict improvement).

## 5. Downstream (later branches)
The dual **Buying/Selling Power dashboards** read these columns (progress = trailing volume &
count vs the next tier's gates); the **14-day Safe-Zone warnings** need G2 + a cron that finds
each user's soonest-expiring volume. Neither is in Branch 3 — it just lays the stateful
foundation the resolver + updater run on.

## Acceptance
Reaching a better tier persists it + a 30-day lock; a mid-window volume drop keeps the locked
rate until expiry, then degrades; checkout charges the effective (locked-or-activity) rate and
snapshots it. `pnpm verify` green; db-guard on the migration; code-reviewer on the resolver +
the checkout/webhook wiring.
