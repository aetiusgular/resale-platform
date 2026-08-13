/**
 * Fee math — single source of truth.
 * All callers import from here. Never inline these calculations elsewhere.
 * Prices are integer cents throughout.
 *
 * FEE MODEL v3 (2026-08): SELLER-ONLY usage-based tiers; buyers pay NO platform fee.
 *   - BUYER  → pays item + shipping only (minus any loyalty-reward discount).
 *   - SELLER → trailing-365d SALES volume + order count set the rate:
 *       base 8.0%  ·  ≥$3k & 3 orders 7.0%  ·  ≥$10k & 10 orders 5.5%  ·  ≥$25k & 15 orders 3.5%
 *     A tier requires BOTH volume AND completed orders (anti wash-trading). The seller
 *     rate is INCLUSIVE of Stripe/PayPal processing (the platform absorbs it). Orders
 *     under $100 are capped at a 5% seller fee. A $0.30 floor (MIN_FEE_CENTS) protects
 *     against a loss after fixed processor cost on micro-items.
 * The tier is resolved SERVER-SIDE at checkout (lib/fee-tier.ts + tier-progress.ts) and
 * snapshotted into the order — never trust the client, never recompute a historical fee.
 */

// ─── Tiered fee model ───────────────────────────────────────────────────────

/**
 * Fee tiers, richest-first. A tier applies only when trailing volume ≥
 * `minVolumeCents` AND completed-order count ≥ `minOrders` (both gates).
 * $25k & 15 orders→3.5% · $10k & 10→5.5% · $3k & 3→7.0% · base→8.0%
 */
export const FEE_TIERS: ReadonlyArray<{ minVolumeCents: number; minOrders: number; bps: number }> = [
  { minVolumeCents: 2_500_000, minOrders: 15, bps: 350 }, // ≥ $25,000 & ≥15 orders → 3.5%
  { minVolumeCents: 1_000_000, minOrders: 10, bps: 550 }, // ≥ $10,000 & ≥10 orders → 5.5%
  { minVolumeCents:   300_000, minOrders:  3, bps: 700 }, // ≥ $3,000  & ≥3  orders → 7.0%
  { minVolumeCents:         0, minOrders:  0, bps: 800 }, // base                   → 8.0%
]

/** Highest fee (new / lowest-activity users). Safe display fallback. */
export const BASE_FEE_BPS = 800

/**
 * Platform floor: minimum fee charged per side ($0.30). Insulates the platform
 * against a net loss after the fixed payment-processor cost on micro-items.
 */
export const MIN_FEE_CENTS = 30

/**
 * Buyer platform fee — ZERO under Fee Model v3. Buyers pay item + shipping only;
 * the seller-side rate (below) is inclusive of the Stripe/PayPal processing cost,
 * which the platform absorbs out of its fee rather than charging the buyer.
 */
export const BUYER_FEE_BPS = 0

/** Orders below this price get the small-order seller-fee cap. */
export const SMALL_ORDER_THRESHOLD_CENTS = 10_000 // $100

/** Sub-$100 orders are capped at a 5% seller fee (unless the tier is already lower). */
export const SMALL_ORDER_CAP_BPS = 500

/**
 * Effective seller bps for one order: on orders under $100 the seller fee is the
 * LOWER of the tier rate or 5%, so small items are cheaper to sell for base/mid
 * sellers while an elite (sub-5%) seller keeps their better rate. Applied inside
 * orderAmountsAt; the tier itself (feeBpsForActivity) is unchanged.
 */
export function effectiveSellerBps(tierBps: number, priceCents: number): number {
  return priceCents < SMALL_ORDER_THRESHOLD_CENTS ? Math.min(tierBps, SMALL_ORDER_CAP_BPS) : tierBps
}

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
 * Buyer fee — ZERO under Fee Model v3 (buyers pay item + shipping only). Params
 * are ignored and retained for call-site compatibility.
 */
export function buyerFeeAt(_priceCents?: number, _bps?: number): number {
  return 0
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
 * Full money breakdown for an order (Fee Model v3).
 *  - Buyer pays item + shipping, minus any loyalty-reward discount. NO buyer fee.
 *  - Seller pays a tier-resolved fee (8→3.5%), capped at 5% on sub-$100 orders,
 *    floored at MIN_FEE_CENTS. That fee is inclusive of payment processing.
 *  - A buyer-reward discount reduces what the BUYER pays; the seller's transfer is
 *    unaffected (the platform funds the discount out of its own fee).
 * Call server-side at PaymentIntent creation; snapshot the result into the order.
 */
export function orderAmountsAt(
  priceCents: number,
  sellerBps: number,
  shippingCents: number = SHIPPING_CENTS,
  buyerDiscountCents: number = 0,
): {
  item_cents:       number
  buyer_fee_cents:  number
  seller_fee_cents: number
  shipping_cents:   number
  discount_cents:   number
  total_cents:      number
  transfer_cents:   number
} {
  const effBps           = effectiveSellerBps(sellerBps, priceCents)
  const seller_fee_cents = sellerFeeAt(priceCents, effBps)
  const gross            = priceCents + shippingCents
  const discount_cents   = Math.max(0, Math.min(Math.round(buyerDiscountCents), gross))
  return {
    item_cents:       priceCents,
    buyer_fee_cents:  0,                       // Fee Model v3: buyers pay no platform fee
    seller_fee_cents,
    shipping_cents:   shippingCents,
    discount_cents,
    total_cents:      gross - discount_cents,
    transfer_cents:   priceCents - seller_fee_cents,  // seller unaffected by buyer discount
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
