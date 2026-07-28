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
  // tiered model
  FEE_TIERS,
  BASE_FEE_BPS,
  feeBpsForVolumeCents,
  feeAt,
  sellerFeeAt,
  buyerFeeAt,
  sellerPayoutAt,
  buyerTotalAt,
  orderAmountsAt,
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
    expect(sellerFee(1)).toBe(0)
    expect(sellerFee(50)).toBe(1)
    expect(sellerFee(249)).toBe(5)
    expect(sellerFee(251)).toBe(5)
    expect(sellerFee(247)).toBe(5)
    expect(sellerFee(246)).toBe(5)
    expect(sellerFee(224)).toBe(4)
  })

  it('large amounts', () => {
    expect(sellerFee(500000)).toBe(10000)
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
    expect(a.buyer_fee_cents).toBe(2500)
    expect(a.seller_fee_cents).toBe(2500)
    expect(a.shipping_cents).toBe(1200)
    expect(a.total_cents).toBe(128700)
    expect(a.transfer_cents).toBe(122500)
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
    const snap1 = orderAmounts(100000)
    const snap2 = orderAmounts(100000)
    expect(snap1).toEqual(snap2)
    expect(snap1.buyer_fee_cents).toBe(2000)
    expect(snap1.seller_fee_cents).toBe(2000)
    expect(snap1.total_cents).toBe(103200)
    expect(snap1.transfer_cents).toBe(98000)
  })

  it('accepts custom shipping amount', () => {
    const a = orderAmounts(100000, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(102000)
  })

  it('all amounts are integers (no floats)', () => {
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

// ─── Tiered, usage-based fee model ──────────────────────────────────────────

describe('FEE_TIERS + BASE_FEE_BPS', () => {
  it('BASE is the worst (highest) rate, 5.5%', () => {
    expect(BASE_FEE_BPS).toBe(550)
  })

  it('tiers are ordered richest-first and monotonic non-increasing in bps', () => {
    for (let i = 1; i < FEE_TIERS.length; i++) {
      expect(FEE_TIERS[i].minVolumeCents).toBeLessThan(FEE_TIERS[i - 1].minVolumeCents)
      expect(FEE_TIERS[i].bps).toBeGreaterThanOrEqual(FEE_TIERS[i - 1].bps)
    }
    // lowest tier floor is 0 (everyone qualifies for at least BASE)
    expect(FEE_TIERS[FEE_TIERS.length - 1].minVolumeCents).toBe(0)
    expect(FEE_TIERS[FEE_TIERS.length - 1].bps).toBe(BASE_FEE_BPS)
  })
})

describe('feeBpsForVolumeCents', () => {
  it('maps each tier band to the right bps (inclusive floors)', () => {
    // < $1,000 → 5.5%
    expect(feeBpsForVolumeCents(0)).toBe(550)
    expect(feeBpsForVolumeCents(99_999)).toBe(550)      // $999.99
    // ≥ $1,000 → 4.5%
    expect(feeBpsForVolumeCents(100_000)).toBe(450)     // $1,000 exactly
    expect(feeBpsForVolumeCents(299_999)).toBe(450)     // $2,999.99
    // ≥ $3,000 → 4.0%
    expect(feeBpsForVolumeCents(300_000)).toBe(400)     // $3,000 exactly
    expect(feeBpsForVolumeCents(499_999)).toBe(400)
    // ≥ $5,000 → 3.5%
    expect(feeBpsForVolumeCents(500_000)).toBe(350)     // $5,000 exactly
    expect(feeBpsForVolumeCents(999_999)).toBe(350)
    // ≥ $10,000 → 2.5%
    expect(feeBpsForVolumeCents(1_000_000)).toBe(250)   // $10,000 exactly
    expect(feeBpsForVolumeCents(5_000_000)).toBe(250)   // $50,000
  })

  it('falls back to BASE for negative / non-finite volume', () => {
    expect(feeBpsForVolumeCents(-1)).toBe(BASE_FEE_BPS)
    expect(feeBpsForVolumeCents(NaN)).toBe(BASE_FEE_BPS)
    // Non-finite is garbage input → conservative BASE, never the best rate by accident.
    expect(feeBpsForVolumeCents(Infinity)).toBe(BASE_FEE_BPS)
  })
})

describe('feeAt + tiered fee helpers', () => {
  it('feeAt rounds half-up and returns integer cents', () => {
    expect(feeAt(10000, 250)).toBe(250)   // 2.5% of $100 = $2.50
    expect(feeAt(10000, 550)).toBe(550)   // 5.5% of $100 = $5.50
    expect(feeAt(249, 550)).toBe(14)      // 5.5% of 249 = 13.695 → 14
    expect(Number.isInteger(feeAt(333, 450))).toBe(true)
  })

  it('sellerPayoutAt / buyerTotalAt compose correctly', () => {
    expect(sellerFeeAt(100000, 550)).toBe(5500)
    expect(buyerFeeAt(100000, 250)).toBe(2500)
    expect(sellerPayoutAt(100000, 550)).toBe(94500)
    expect(buyerTotalAt(100000, 250)).toBe(102500)
  })
})

describe('orderAmountsAt (per-side tiered)', () => {
  it('applies buyer and seller rates independently', () => {
    // buyer is tier-1 (2.5%), seller is base (5.5%), $1,000 item
    const a = orderAmountsAt(100000, 250, 550)
    expect(a.item_cents).toBe(100000)
    expect(a.buyer_fee_cents).toBe(2500)     // 2.5%
    expect(a.seller_fee_cents).toBe(5500)    // 5.5%
    expect(a.shipping_cents).toBe(1200)
    expect(a.total_cents).toBe(103700)       // 100000 + 2500 + 1200
    expect(a.transfer_cents).toBe(94500)     // 100000 - 5500
  })

  it('invariants hold for arbitrary tier combos', () => {
    const rates = [250, 350, 400, 450, 550]
    for (const price of [999, 5000, 49999, 125000, 500000]) {
      for (const b of rates) for (const s of rates) {
        const a = orderAmountsAt(price, b, s)
        expect(a.transfer_cents).toBe(a.item_cents - a.seller_fee_cents)
        expect(a.total_cents).toBe(a.item_cents + a.buyer_fee_cents + a.shipping_cents)
        for (const v of Object.values(a)) expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('is a superset of the legacy flat-2% behaviour when both rates are 200', () => {
    for (const price of [5000, 10000, 49999, 125000]) {
      expect(orderAmountsAt(price, 200, 200)).toEqual(orderAmounts(price))
    }
  })

  it('respects custom shipping', () => {
    const a = orderAmountsAt(100000, 250, 550, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(102500) // item + buyer_fee only
  })
})
