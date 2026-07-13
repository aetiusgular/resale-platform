/**
 * Fee math — single source of truth.
 * All callers import from here. Never inline these calculations elsewhere.
 * Prices are integer cents throughout.
 */

export const SELLER_FEE_BPS = 200 // 2%
export const BUYER_FEE_BPS  = 200 // 2%

/** Seller fee charged on the listing price. Rounds half-up. */
export function sellerFee(priceCents: number): number {
  return Math.round(priceCents * SELLER_FEE_BPS / 10000)
}

/** Buyer fee added on top of the listing price. Rounds half-up. */
export function buyerFee(priceCents: number): number {
  return Math.round(priceCents * BUYER_FEE_BPS / 10000)
}

/** Amount transferred to the seller after platform fee. */
export function sellerPayout(priceCents: number): number {
  return priceCents - sellerFee(priceCents)
}

/** Total charged to the buyer (listing price + buyer fee). */
export function buyerTotal(priceCents: number): number {
  return priceCents + buyerFee(priceCents)
}

/** Format integer cents as a dollar string (no decimals for whole dollars). */
export function formatCents(cents: number): string {
  const dollars = cents / 100
  return '$' + dollars.toLocaleString('en-US', {
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
