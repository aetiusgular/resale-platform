/**
 * Fee-tier resolver — SERVER ONLY.
 *
 * Resolves a user's fee rate (basis points) from their TRAILING-365-DAY volume
 * of completed, non-reversed orders. Each side is rated on its own activity:
 *   - BUYER  → trailing-365d PURCHASE volume  (orders where buyer_id = user)
 *   - SELLER → trailing-365d SALES volume     (orders where seller_id = user)
 * Reversed orders ('cancelled','refunded') are EXCLUDED so volume cannot be
 * gamed by self-dealing then cancelling. Volume basis is item_cents (item price).
 *
 * Uses the service-role client (bypasses RLS to read across both parties'
 * orders) — NEVER import into a client component. Wire at PaymentIntent
 * creation (app/api/checkout/route.ts) and snapshot the resolved cents into the
 * order; never recompute a historical order's fee.
 *
 * The tier table + bps mapping live in lib/fees.ts (feeBpsForVolumeCents).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { feeBpsForVolumeCents, BASE_FEE_BPS } from '@/lib/fees'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export type FeeSide = 'buyer' | 'seller'

/** Trailing window for volume-based tiering. */
export const TRAILING_DAYS = 365

/** Order states that do NOT count toward volume (anti-gaming). */
export const NON_COUNTING_STATES = ['cancelled', 'refunded'] as const

/**
 * Sum of item_cents for a user's completed, non-reversed orders on the given
 * side within the trailing window. Returns 0 on no rows or query error.
 * (In-app aggregation is fine at launch scale; move to a SQL rollup if a single
 * user's trailing order count ever gets large.)
 */
export async function trailingVolumeCents(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number> {
  const column = side === 'buyer' ? 'buyer_id' : 'seller_id'
  const cutoffIso = new Date(Date.now() - TRAILING_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await service
    .from('orders')
    .select('item_cents')
    .eq(column, userId)
    .gte('created_at', cutoffIso)
    .not('state', 'in', `(${NON_COUNTING_STATES.join(',')})`)

  if (error || !data) return 0
  const rows = data as Array<{ item_cents: number }>
  return rows.reduce((sum, r) => sum + (r.item_cents ?? 0), 0)
}

/**
 * Resolve the fee rate (basis points) for a user on the given side.
 * FAIL-SAFE: on any lookup failure returns BASE_FEE_BPS (the highest / default
 * new-user rate) and logs — never hands out a better rate because of an error.
 */
export async function feeBpsForUser(
  service: ServiceClient,
  userId: string,
  side: FeeSide,
): Promise<number> {
  try {
    const volume = await trailingVolumeCents(service, userId, side)
    return feeBpsForVolumeCents(volume)
  } catch (err) {
    console.error(`[fee-tier] volume lookup failed for ${side} ${userId}; charging BASE`, err)
    return BASE_FEE_BPS
  }
}
