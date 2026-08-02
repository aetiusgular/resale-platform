/**
 * Fee math — single source of truth.
 * All callers import from here. Never inline these calculations elsewhere.
 * Prices are integer cents throughout.
 *
 * FEE MODEL v2 (2026-07): asymmetric usage-based tiers, always-free-to-join.
 * A user's fee rate is set by their trailing-365-day activity, and a tier now
 * requires BOTH enough volume AND enough completed orders (anti wash-trading):
 *   - BUYER fee  → buyer's trailing-365d PURCHASE volume + order count
 *   - SELLER fee → seller's trailing-365d SALES volume + order count
 * Each side is rated on their own activity. The tier is resolved SERVER-SIDE at
 * checkout (see lib/fee-tier.ts + app/api/checkout/route.ts) and snapshotted into
 * checkout_sessions / order metadata — never trust the client, never recompute a
 * historical order's fee. A per-side $0.30 floor (MIN_FEE_CENTS) protects against
 * a loss after the fixed payment-processor cost on micro-items.
 */

// ─── Tiered fee model ───────────────────────────────────────────────────────

/**
 * Fee tiers, richest-first. A tier applies only when trailing volume ≥
 * `minVolumeCents` AND completed-order count ≥ `minOrders` (both gates).
 * $10k & 15 orders→2.0% · $5k & 10→3.0% · $3k & 7→3.5% · $1k & 3→4.0% · base→5.0%
 */
export const FEE_TIERS: ReadonlyArray<{ minVolumeCents: number; minOrders: number; bps: number }> = [
  { minVolumeCents: 1_000_000, minOrders: 15, bps: 200 }, // ≥ $10,000 & ≥15 orders → 2.0%
  { minVolumeCents:   500_000, minOrders: 10, bps: 300 }, // ≥ $5,000  & ≥10 orders → 3.0%
  { minVolumeCents:   300_000, minOrders:  7, bps: 350 }, // ≥ $3,000  & ≥7  orders → 3.5%
  { minVolumeCents:   100_000, minOrders:  3, bps: 400 }, // ≥ $1,000  & ≥3  orders → 4.0%
  { minVolumeCents:         0, minOrders:  0, bps: 500 }, // base                   → 5.0%
]

/** Highest fee (new / lowest-activity users). Safe display fallback. */
export const BASE_FEE_BPS = 500

/**
 * Platform floor: minimum fee charged per side ($0.30). Insulates the platform
 * against a net loss after the fixed payment-processor cost on micro-items.
 */
export const MIN_FEE_CENTS = 30

/**
 * Authoritative rate: the richest tier where trailing volume ≥ minVolumeCents
 * AND completed-order count ≥ minOrders. Both gates must pass — enough volume on
 * too few orders drops to the lower tier the order count clears (this is what
 * kills single-order wash-trading to jump tiers). Garbage volume → BASE.
 */
export function feeBpsForActivity(volumeCents: number, orderCount: number): number {
  if (!Number.isFinite(volumeCents) || volumeCents < 0) return BASE_FEE_BPS
  const count = Number.isFinite(orderCount) && orderCount >= 0 ? orderCount : 0
  for (const tier of FEE_TIERS) {
    if (volumeCents >= tier.minVolumeCents && count >= tier.minOrders) return tier.bps
  }
  return BASE_FEE_BPS
}

/**
 * @deprecated Volume-only view (IGNORES the order-count gate) — for display /
 * fallback only. The authoritative charged rate is feeBpsForActivity, resolved
 * in lib/fee-tier.ts from both trailing volume and order count.
 */
export function feeBpsForVolumeCents(trailingVolumeCents: number): number {
  return feeBpsForActivity(trailingVolumeCents, Number.MAX_SAFE_INTEGER)
}

/** Generic fee on an amount at an explicit rate. Rounds half-up. Integer cents. */
export function feeAt(priceCents: number, bps: number): number {
  return Math.round(priceCents * bps / 10000)
}

/**
 * Seller fee at an explicit (tier-resolved) rate. Floored at MIN_FEE_CENTS, then
 * CAPPED at the item price so the fee can never exceed what the item sold for —
 * this guarantees a non-negative seller payout even on sub-$0.30 items where the
 * floor would otherwise be larger than the price.
 */
export function sellerFeeAt(priceCents: number, bps: number): number {
  return Math.min(priceCents, Math.max(feeAt(priceCents, bps), MIN_FEE_CENTS))
}

/**
 * Buyer fee at an explicit (tier-resolved) rate. Floored at MIN_FEE_CENTS, then
 * capped at the item price (mirrors sellerFeeAt so the fee never exceeds the
 * item's value on micro-items).
 */
export function buyerFeeAt(priceCents: number, bps: number): number {
  return Math.min(priceCents, Math.max(feeAt(priceCents, bps), MIN_FEE_CENTS))
}

/** Amount transferred to the seller after their tier fee. */
export function sellerPayoutAt(priceCents: number, sellerBps: number): number {
  return priceCents - sellerFeeAt(priceCents, sellerBps)
}

/** Total charged to the buyer (item + their tier buyer fee). */
export function buyerTotalAt(priceCents: number, buyerBps: number): number {
  return priceCents + buyerFeeAt(priceCents, buyerBps)
}

/**
 * Tiered full breakdown for an order. Buyer and seller each pay their own
 * tier-resolved rate (floored at MIN_FEE_CENTS each side).
 * Call server-side at PaymentIntent creation with rates from lib/fee-tier.ts.
 * Result maps 1:1 to the orders / checkout_sessions columns.
 */
export function orderAmountsAt(
  priceCents: number,
  buyerBps: number,
  sellerBps: number,
  shippingCents: number = SHIPPING_CENTS,
): {
  item_cents:       number
  buyer_fee_cents:  number
  seller_fee_cents: number
  shipping_cents:   number
  total_cents:      number
  transfer_cents:   number
} {
  const buyer_fee_cents  = buyerFeeAt(priceCents, buyerBps)
  const seller_fee_cents = sellerFeeAt(priceCents, sellerBps)
  return {
    item_cents:       priceCents,
    buyer_fee_cents,
    seller_fee_cents,
    shipping_cents:   shippingCents,
    total_cents:      priceCents + buyer_fee_cents + shippingCents,
    transfer_cents:   priceCents - seller_fee_cents,
  }
}

/** Format integer cents as a dollar string (no decimals for whole dollars). */
export function formatCents(cents: number): string {
  const dollars = cents / 100
  return '$' + dollars.toLocaleString('en-US', {
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** Fixed shipping cost for alpha (buyer-paid, $12). */
export const SHIPPING_CENTS = 1200
