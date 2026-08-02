/**
 * Fee-tier resolver — SERVER ONLY.
 *
 * Resolves a user's fee rate (basis points) from their TRAILING-365-DAY activity
 * (volume AND delivered-order count). Each side is rated on its own activity:
 *   - BUYER  → trailing-365d PURCHASE activity (orders where buyer_id = user)
 *   - SELLER → trailing-365d SALES activity    (orders where seller_id = user)
 * Only DELIVERED sales count (state in COUNTED_STATES) — nothing counts until the
 * buyer actually receives the item, so activity cannot be gamed by self-dealing
 * paid-but-undelivered orders, and refunds/cancels never inflate it. Volume basis
 * is item_cents, and each order contributes at most
 * MAX_ORDER_VOLUME_CONTRIBUTION_CENTS toward the volume gate (a single high-value
 * order can't buy a tier jump); the order COUNT is unaffected by that cap.
 *
 * Uses the service-role client (bypasses RLS to read across both parties'
 * orders) — NEVER import into a client component. Wire at PaymentIntent
 * creation (app/api/checkout/route.ts) and snapshot the resolved cents into the
 * order; never recompute a historical order's fee.
 *
 * The tier table + bps mapping live in lib/fees.ts (feeBpsForActivity).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { feeBpsForActivity, BASE_FEE_BPS } from '@/lib/fees'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export type FeeSide = 'buyer' | 'seller'

/** Trailing window for volume-based tiering. */
export const TRAILING_DAYS = 365

/**
 * Only DELIVERED sales count toward activity (tier progress) and compliance
 * volume. `released` is the post-delivery terminal state (funds released), so it
 * is included — an auto-released order must keep counting. In-flight states
 * (paid_held / seller_confirmed / shipped), `disputed`, and reversed
 * (cancelled / refunded) orders do NOT count: nothing counts until the buyer
 * actually receives the item.
 */
export const COUNTED_STATES = ['delivered', 'released'] as const

/**
 * A single order contributes at most $2,000 toward tier-VOLUME progress (this is
 * the 20%-of-Elite-threshold velocity guard). The order COUNT is unaffected.
 */
export const MAX_ORDER_VOLUME_CONTRIBUTION_CENTS = 200_000

/**
 * Shared query: item_cents rows for a user's non-reversed orders on the given
 * side within the trailing window. Returns [] on no rows or query error, so both
 * callers fail closed (zero volume / count). Single source of the state filter.
 * (In-app aggregation is fine at launch scale; move to a SQL rollup if a single
 * user's trailing order count ever gets large.)
 */
async function trailingOrderItemCents(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number[]> {
  const column = side === 'buyer' ? 'buyer_id' : 'seller_id'
  const cutoffIso = new Date(Date.now() - TRAILING_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await service
    .from('orders')
    .select('item_cents')
    .eq(column, userId)
    .gte('created_at', cutoffIso)
    .in('state', COUNTED_STATES as unknown as string[])

  if (error || !data) return []
  return (data as Array<{ item_cents: number }>).map((r) => r.item_cents ?? 0)
}

/**
 * Trailing-365d activity for a user on the given side: TIER-CAPPED volume + order
 * count. Each order contributes at most MAX_ORDER_VOLUME_CONTRIBUTION_CENTS toward
 * volume (anti single-item tier jump); the count is uncapped. Feeds the fee tier.
 */
export async function trailingActivity(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<{ volumeCents: number; orderCount: number }> {
  const items = await trailingOrderItemCents(service, userId, side)
  return {
    volumeCents: items.reduce(
      (sum, cents) => sum + Math.min(cents, MAX_ORDER_VOLUME_CONTRIBUTION_CENTS),
      0,
    ),
    orderCount: items.length,
  }
}

/**
 * Trailing-365d GROSS sales volume — UNCAPPED (true gross, ignores the tier cap).
 * Used by the ID-verification trigger (lib/idv/verification-policy.ts), a legal
 * INFORM-Act threshold that must never under-count. DO NOT route this through the
 * tier-capped trailingActivity — the cap must not shrink a compliance number.
 */
export async function trailingVolumeCents(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number> {
  const items = await trailingOrderItemCents(service, userId, side)
  return items.reduce((sum, cents) => sum + cents, 0)
}

/**
 * Resolve the fee rate (basis points) for a user on the given side, from BOTH
 * trailing volume and order count.
 * FAIL-SAFE: on any lookup failure returns BASE_FEE_BPS (the highest / default
 * new-user rate) and logs — never hands out a better rate because of an error.
 */
export async function feeBpsForUser(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number> {
  try {
    const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
    return feeBpsForActivity(volumeCents, orderCount)
  } catch (err) {
    console.error(`[fee-tier] activity lookup failed for ${side} ${userId}; charging BASE`, err)
    return BASE_FEE_BPS
  }
}
