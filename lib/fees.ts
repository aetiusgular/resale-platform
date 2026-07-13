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

/** Fixed shipping cost for alpha (buyer-paid, $12). */
export const SHIPPING_CENTS = 1200

/**
 * Compute the full fee breakdown for an order.
 * Call this server-side at PaymentIntent creation — NEVER trust client totals.
 * The returned object maps 1:1 to the orders table column names.
 *
 * transfer_cents = item_cents - seller_fee_cents
 * (shipping is buyer-paid; platform holds it in alpha)
 */
export function orderAmounts(
  priceCents: number,
  shippingCents: number = SHIPPING_CENTS,
): {
  item_cents:       number
  buyer_fee_cents:  number
  seller_fee_cents: number
  shipping_cents:   number
  total_cents:      number
  transfer_cents:   number
} {
  const buyer_fee_cents  = buyerFee(priceCents)
  const seller_fee_cents = sellerFee(priceCents)
  return {
    item_cents:       priceCents,
    buyer_fee_cents,
    seller_fee_cents,
    shipping_cents:   shippingCents,
    total_cents:      priceCents + buyer_fee_cents + shippingCents,
    transfer_cents:   priceCents - seller_fee_cents,
  }
}
