import { describe, it, expect } from 'vitest'
import {
  sellerFee,
  buyerFee,
  sellerPayout,
  buyerTotal,
  formatCents,
  SELLER_FEE_BPS,
  BUYER_FEE_BPS,
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
