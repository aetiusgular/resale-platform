/**
 * Fee math — single source of truth.
 * All callers import from here. Never inline these calculations elsewhere.
 * Prices are integer cents throughout.
 *
 * FEE MODEL (2026-07 change): usage-based tiers, always-free-to-join.
 * A user's fee rate is set by their trailing-365-day activity:
 *   - BUYER fee  → buyer's trailing-365d PURCHASE volume
 *   - SELLER fee → seller's trailing-365d SALES volume
 * Each side is rated on their own activity. The tier is resolved SERVER-SIDE at
 * checkout (see lib/fee-tier.ts + app/api/checkout/route.ts) and snapshotted into
 * checkout_sessions / order metadata — never trust the client, never recompute a
 * historical order's fee.
 */

// ─── Tiered fee model ───────────────────────────────────────────────────────

/**
 * Fee tiers, richest-first. `minVolumeCents` is the INCLUSIVE trailing-365d
 * volume floor (in integer cents) at which `bps` applies.
 * $10,000→2.5% · $5,000→3.5% · $3,000→4.0% · $1,000→4.5% · <$1,000→5.5%
 */
export const FEE_TIERS: ReadonlyArray<{ minVolumeCents: number; bps: number }> = [
  { minVolumeCents: 1_000_000, bps: 250 }, // ≥ $10,000 → 2.5%
  { minVolumeCents:   500_000, bps: 350 }, // ≥ $5,000  → 3.5%
  { minVolumeCents:   300_000, bps: 400 }, // ≥ $3,000  → 4.0%
  { minVolumeCents:   100_000, bps: 450 }, // ≥ $1,000  → 4.5%
  { minVolumeCents:         0, bps: 550 }, // <  $1,000 → 5.5%
]

/** Highest fee (new / lowest-activity users). Safe display fallback. */
export const BASE_FEE_BPS = 550

/**
 * Resolve the fee rate (basis points) for a given trailing-365d volume in cents.
 * Monotonic non-increasing in volume. Negative/NaN volume falls back to BASE.
 */
export function feeBpsForVolumeCents(trailingVolumeCents: number): number {
  if (!Number.isFinite(trailingVolumeCents) || trailingVolumeCents < 0) {
    return BASE_FEE_BPS
  }
  for (const tier of FEE_TIERS) {
    if (trailingVolumeCents >= tier.minVolumeCents) return tier.bps
  }
  return BASE_FEE_BPS
}

/** Generic fee on an amount at an explicit rate. Rounds half-up. Integer cents. */
export function feeAt(priceCents: number, bps: number): number {
  return Math.round(priceCents * bps / 10000)
}

/** Seller fee at an explicit (tier-resolved) rate. */
export function sellerFeeAt(priceCents: number, bps: number): number {
  return feeAt(priceCents, bps)
}

/** Buyer fee at an explicit (tier-resolved) rate. */
export function buyerFeeAt(priceCents: number, bps: number): number {
  return feeAt(priceCents, bps)
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
 * Tiered full breakdown for an order. Drop-in replacement for orderAmounts(),
 * but buyer and seller each pay their own tier-resolved rate.
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
