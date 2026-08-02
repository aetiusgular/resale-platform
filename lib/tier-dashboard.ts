/**
 * Tier dashboard (business-model-v2 §1f) — SERVER helper + PURE core.
 *
 * Surfaces the tier state the fee engine already computes, for the settings
 * "Buying & selling power" pane:
 *   - current effective rate (activity rate, floored by a still-active 30-day lock)
 *   - progress to the next better tier (BOTH the volume AND the order-count gate)
 *   - a 14-day expiring-volume warning: how much trailing volume / how many orders
 *     roll out of the 365-day window in the next 14 days, and the tier that would
 *     result with no new activity (the lock is called out separately as a cushion).
 *
 * Mirrors lib/fee-tier.ts: the service client is passed IN (only a `type` import),
 * so this module has no runtime server-only dependency and the pure core is unit-
 * testable in isolation. Display only — never charges; the authoritative charged
 * rate stays lib/fee-tier.ts + the checkout snapshot.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { FEE_TIERS, feeBpsForActivity } from '@/lib/fees'
import {
  MAX_ORDER_VOLUME_CONTRIBUTION_CENTS,
  TRAILING_DAYS,
  COUNTED_STATES,
  type FeeSide,
} from '@/lib/fee-tier'
import { effectiveTierBps } from '@/lib/tier-state'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/** How far ahead we warn that trailing volume/orders are about to roll off. */
export const EXPIRY_WARNING_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export type TierGate = { minVolumeCents: number; minOrders: number; bps: number }

export type SideDashboard = {
  side: FeeSide
  /** Tier-capped trailing-365d volume (each order <= the per-order cap). */
  volumeCents: number
  orderCount: number
  /** Pure activity rate (both gates), ignoring any lock. */
  activityBps: number
  /** Rate actually charged today: activity floored by a still-active lock. */
  effectiveBps: number
  /** True when a still-active lock is STRICTLY better than the activity rate. */
  locked: boolean
  lockedUntilMs: number | null
  /** The tier the user currently sits in (by activity). */
  current: TierGate
  /** The next better tier, or null when already at the best rate. */
  next: TierGate | null
  volumeToNextCents: number
  ordersToNext: number
  /** Volume/orders that leave the 365-day window within EXPIRY_WARNING_DAYS. */
  expiringVolumeCents: number
  expiringOrderCount: number
  /** Activity rate that would result after that roll-off with no new activity. */
  projectedBps: number
  /** projectedBps is strictly worse (higher) than today's activity rate. */
  willDropTier: boolean
}

/** Basis points -> display percent, e.g. 200 -> "2.0%". */
export function fmtRate(bps: number): string {
  return (bps / 100).toFixed(1) + '%'
}

/**
 * PURE core: derive a side's dashboard from its trailing counted orders + the
 * stored lock. `orders` should already be the counted-state rows within the
 * window; we defensively re-filter by window and clamp/caps volume so the numbers
 * match feeBpsForActivity exactly.
 */
export function computeSideDashboard(
  side: FeeSide,
  orders: ReadonlyArray<{ createdAtMs: number; itemCents: number }>,
  lockedBps: number | null,
  lockedUntilMs: number | null,
  nowMs: number,
): SideDashboard {
  const trailingMs = TRAILING_DAYS * DAY_MS
  const warnMs = EXPIRY_WARNING_DAYS * DAY_MS
  const windowStart = nowMs - trailingMs
  const cap = (c: number) => Math.min(Math.max(Number.isFinite(c) ? c : 0, 0), MAX_ORDER_VOLUME_CONTRIBUTION_CENTS)

  const inWindow = orders.filter((o) => o.createdAtMs > windowStart)
  const volumeCents = inWindow.reduce((s, o) => s + cap(o.itemCents), 0)
  const orderCount = inWindow.length

  const activityBps = feeBpsForActivity(volumeCents, orderCount)
  const effectiveBps = effectiveTierBps(activityBps, lockedBps, lockedUntilMs, nowMs)
  const lockActive = lockedBps != null && lockedUntilMs != null && nowMs < lockedUntilMs
  const locked = Boolean(lockActive && (lockedBps as number) < activityBps)

  // current = richest tier both gates clear (base tier 0/0 always clears).
  const currentIdx = FEE_TIERS.findIndex((t) => volumeCents >= t.minVolumeCents && orderCount >= t.minOrders)
  const idx = currentIdx >= 0 ? currentIdx : FEE_TIERS.length - 1
  const current = FEE_TIERS[idx]
  const next = idx > 0 ? FEE_TIERS[idx - 1] : null
  const volumeToNextCents = next ? Math.max(0, next.minVolumeCents - volumeCents) : 0
  const ordersToNext = next ? Math.max(0, next.minOrders - orderCount) : 0

  // Orders old enough to exit the window within the warning horizon.
  const expiring = inWindow.filter((o) => o.createdAtMs <= nowMs - (trailingMs - warnMs))
  const expiringVolumeCents = expiring.reduce((s, o) => s + cap(o.itemCents), 0)
  const expiringOrderCount = expiring.length
  const projectedBps = feeBpsForActivity(volumeCents - expiringVolumeCents, orderCount - expiringOrderCount)
  const willDropTier = projectedBps > activityBps

  return {
    side, volumeCents, orderCount, activityBps, effectiveBps, locked, lockedUntilMs,
    current, next, volumeToNextCents, ordersToNext,
    expiringVolumeCents, expiringOrderCount, projectedBps, willDropTier,
  }
}

const LOCK_COL = {
  buyer: { bps: 'current_buyer_tier_bps', until: 'buyer_tier_locked_until' },
  seller: { bps: 'current_seller_tier_bps', until: 'seller_tier_locked_until' },
} as const

/**
 * SERVER: fetch a user's trailing counted orders (created_at + item_cents) and
 * stored lock for one side, and compute the dashboard. FAIL-SAFE: any read error
 * yields the empty/base dashboard (never a fabricated better tier).
 */
export async function getTierDashboard(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<SideDashboard> {
  const nowMs = Date.now()
  try {
    const column = side === 'buyer' ? 'buyer_id' : 'seller_id'
    const cutoffIso = new Date(nowMs - TRAILING_DAYS * DAY_MS).toISOString()
    const { data } = await service
      .from('orders')
      .select('item_cents, created_at')
      .eq(column, userId)
      .gte('created_at', cutoffIso)
      .in('state', COUNTED_STATES as unknown as string[])
    const rows = (data ?? []) as Array<{ item_cents: number; created_at: string }>
    const orders = rows.map((r) => ({ createdAtMs: Date.parse(r.created_at), itemCents: r.item_cents ?? 0 }))

    const cols = LOCK_COL[side]
    const { data: prof } = await service
      .from('profiles')
      .select(`${cols.bps}, ${cols.until}`)
      .eq('id', userId)
      .single()
    const row = (prof ?? null) as Record<string, unknown> | null
    const lockedBps = (row?.[cols.bps] as number | null) ?? null
    const untilRaw = row?.[cols.until] as string | null | undefined
    const lockedUntilMs = untilRaw ? Date.parse(untilRaw) : null

    return computeSideDashboard(side, orders, lockedBps, lockedUntilMs, nowMs)
  } catch (err) {
    console.error(`[tier-dashboard] fetch failed for ${side} ${userId}; showing base`, err)
    return computeSideDashboard(side, [], null, null, nowMs)
  }
}
