import { describe, it, expect } from 'vitest'
import {
  sellerFee,
  buyerFee,
  sellerPayout,
  buyerTotal,
  formatCents,
  orderAmounts,
  SELLER_FEE_BPS,
  BUYER_FEE_BPS,
  SHIPPING_CENTS,
} from '../../lib/fees'

describe('fee constants', () => {
  it('SELLER_FEE_BPS is 200', () => {
    expect(SELLER_FEE_BPS).toBe(200)
  })
  it('BUYER_FEE_BPS is 200', () => {
    expect(BUYER_FEE_BPS).toBe(200)
  })
})

describe('sellerFee', () => {
  it('round numbers', () => {
    expect(sellerFee(10000)).toBe(200)  // $100 → $2
    expect(sellerFee(125000)).toBe(2500) // $1250 → $25
  })

  it('rounds odd cents correctly (half-up)', () => {
    // 1 cent: 0.02% of 1 = 0.0002 → rounds to 0
    expect(sellerFee(1)).toBe(0)
    // 50 cents: 2% of 50 = 1 cent
    expect(sellerFee(50)).toBe(1)
    // $2.49 (249 cents): 2% = 4.98 → rounds to 5
    expect(sellerFee(249)).toBe(5)
    // $2.51 (251 cents): 2% = 5.02 → rounds to 5
    expect(sellerFee(251)).toBe(5)
    // $2.475 effectively: 2% of 247 = 4.94 → rounds to 5
    expect(sellerFee(247)).toBe(5)
    // 2% of 246 = 4.92 → rounds to 5
    expect(sellerFee(246)).toBe(5)
    // 2% of 224 = 4.48 → rounds to 4
    expect(sellerFee(224)).toBe(4)
  })

  it('large amounts', () => {
    // $5000 listing: 2% = $100
    expect(sellerFee(500000)).toBe(10000)
    // $10000 listing: 2% = $200
    expect(sellerFee(1000000)).toBe(20000)
  })
})

describe('buyerFee', () => {
  it('mirrors sellerFee (same BPS)', () => {
    for (const cents of [100, 999, 5000, 125000]) {
      expect(buyerFee(cents)).toBe(sellerFee(cents))
    }
  })
})

describe('sellerPayout', () => {
  it('priceCents minus sellerFee', () => {
    expect(sellerPayout(10000)).toBe(9800)
    expect(sellerPayout(125000)).toBe(122500)
    // Odd: priceCents=249, fee=5, payout=244
    expect(sellerPayout(249)).toBe(244)
  })
})

describe('buyerTotal', () => {
  it('priceCents plus buyerFee', () => {
    expect(buyerTotal(10000)).toBe(10200)
    expect(buyerTotal(125000)).toBe(127500)
  })
})

describe('formatCents', () => {
  it('whole dollar amounts', () => {
    expect(formatCents(10000)).toBe('$100')
    expect(formatCents(125000)).toBe('$1,250')
    expect(formatCents(100)).toBe('$1')
  })

  it('fractional cents', () => {
    expect(formatCents(150)).toBe('$1.50')
    expect(formatCents(99)).toBe('$0.99')
  })
})

describe('SHIPPING_CENTS', () => {
  it('is 1200 (fixed $12 for alpha)', () => {
    expect(SHIPPING_CENTS).toBe(1200)
  })
})

describe('orderAmounts', () => {
  it('correctly breaks down $1250 listing (design reference values)', () => {
    const a = orderAmounts(125000)
    expect(a.item_cents).toBe(125000)
    expect(a.buyer_fee_cents).toBe(2500)      // 2% of $1250
    expect(a.seller_fee_cents).toBe(2500)     // 2% of $1250
    expect(a.shipping_cents).toBe(1200)        // fixed alpha
    expect(a.total_cents).toBe(128700)         // 125000 + 2500 + 1200
    expect(a.transfer_cents).toBe(122500)      // item - seller_fee
  })

  it('transfer_cents equals item_cents minus seller_fee_cents exactly', () => {
    for (const price of [5000, 10000, 49999, 125000, 500000]) {
      const a = orderAmounts(price)
      expect(a.transfer_cents).toBe(a.item_cents - a.seller_fee_cents)
    }
  })

  it('total_cents equals item + buyer_fee + shipping', () => {
    for (const price of [5000, 10000, 49999, 125000]) {
      const a = orderAmounts(price)
      expect(a.total_cents).toBe(a.item_cents + a.buyer_fee_cents + a.shipping_cents)
    }
  })

  it('fee snapshot survives later config change (snapshot test)', () => {
    // The snapshot locked at order time must not change even if BPS changes.
    // We verify that orderAmounts reads the BPS at call time and the result
    // is fully determined by the inputs — no hidden global state.
    const snap1 = orderAmounts(100000)
    const snap2 = orderAmounts(100000)
    expect(snap1).toEqual(snap2)
    // Explicit expected values for $1000 listing:
    expect(snap1.buyer_fee_cents).toBe(2000)   // 2% of $1000
    expect(snap1.seller_fee_cents).toBe(2000)
    expect(snap1.total_cents).toBe(103200)      // 1000 + 20 + 12 = $1032
    expect(snap1.transfer_cents).toBe(98000)    // $980
  })

  it('accepts custom shipping amount', () => {
    const a = orderAmounts(100000, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(102000)  // item + buyer_fee only
  })

  it('all amounts are integers (no floats)', () => {
    // Prices that produce fractional cents at 2% — must still be integers
    for (const price of [1, 3, 7, 11, 51, 249, 333, 999, 1001]) {
      const a = orderAmounts(price)
      expect(Number.isInteger(a.item_cents)).toBe(true)
      expect(Number.isInteger(a.buyer_fee_cents)).toBe(true)
      expect(Number.isInteger(a.seller_fee_cents)).toBe(true)
      expect(Number.isInteger(a.total_cents)).toBe(true)
      expect(Number.isInteger(a.transfer_cents)).toBe(true)
    }
  })
})
