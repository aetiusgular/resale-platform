import { describe, it, expect } from 'vitest'
import {
  formatCents,
  SHIPPING_CENTS,
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
    expect(FEE_TIERS[FEE_TIERS.length - 1].minVolumeCents).toBe(0)
    expect(FEE_TIERS[FEE_TIERS.length - 1].bps).toBe(BASE_FEE_BPS)
  })
})

describe('feeBpsForVolumeCents', () => {
  it('maps each tier band to the right bps (inclusive floors)', () => {
    expect(feeBpsForVolumeCents(0)).toBe(550)
    expect(feeBpsForVolumeCents(99_999)).toBe(550)      // $999.99
    expect(feeBpsForVolumeCents(100_000)).toBe(450)     // $1,000
    expect(feeBpsForVolumeCents(299_999)).toBe(450)
    expect(feeBpsForVolumeCents(300_000)).toBe(400)     // $3,000
    expect(feeBpsForVolumeCents(499_999)).toBe(400)
    expect(feeBpsForVolumeCents(500_000)).toBe(350)     // $5,000
    expect(feeBpsForVolumeCents(999_999)).toBe(350)
    expect(feeBpsForVolumeCents(1_000_000)).toBe(250)   // $10,000
    expect(feeBpsForVolumeCents(5_000_000)).toBe(250)
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
    // buyer tier-1 (2.5%), seller base (5.5%), $1,000 item
    const a = orderAmountsAt(100000, 250, 550)
    expect(a.item_cents).toBe(100000)
    expect(a.buyer_fee_cents).toBe(2500)
    expect(a.seller_fee_cents).toBe(5500)
    expect(a.shipping_cents).toBe(1200)
    expect(a.total_cents).toBe(103700)
    expect(a.transfer_cents).toBe(94500)
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

  it('at 200/200 bps reproduces the legacy flat-2% breakdown', () => {
    for (const price of [5000, 10000, 49999, 125000]) {
      const a = orderAmountsAt(price, 200, 200)
      const fee = Math.round((price * 200) / 10000)
      expect(a.buyer_fee_cents).toBe(fee)
      expect(a.seller_fee_cents).toBe(fee)
      expect(a.shipping_cents).toBe(1200)
      expect(a.total_cents).toBe(price + fee + 1200)
      expect(a.transfer_cents).toBe(price - fee)
    }
  })

  it('respects custom shipping', () => {
    const a = orderAmountsAt(100000, 250, 550, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(102500) // item + buyer_fee only
  })
})
