import { describe, it, expect } from 'vitest'
import {
  formatCents,
  SHIPPING_CENTS,
  FEE_TIERS,
  BASE_FEE_BPS,
  MIN_FEE_CENTS,
  feeBpsForActivity,
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

// ─── Tiered fee model v2 (rates, order-count AND-gate, $0.30 floor) ──────────

describe('FEE_TIERS + BASE_FEE_BPS (v2)', () => {
  it('base is 5.0% and tiers descend 500→200 with volume + order gates', () => {
    expect(BASE_FEE_BPS).toBe(500)
    expect(FEE_TIERS.map(t => t.bps)).toEqual([200, 300, 350, 400, 500])
    expect(FEE_TIERS.map(t => t.minVolumeCents)).toEqual([1_000_000, 500_000, 300_000, 100_000, 0])
    expect(FEE_TIERS.map(t => t.minOrders)).toEqual([15, 10, 7, 3, 0])
  })
  it('tiers are richest-first and monotonic non-increasing in bps; base floor at 0', () => {
    for (let i = 1; i < FEE_TIERS.length; i++) {
      expect(FEE_TIERS[i].minVolumeCents).toBeLessThan(FEE_TIERS[i - 1].minVolumeCents)
      expect(FEE_TIERS[i].bps).toBeGreaterThanOrEqual(FEE_TIERS[i - 1].bps)
    }
    expect(FEE_TIERS[FEE_TIERS.length - 1].minVolumeCents).toBe(0)
    expect(FEE_TIERS[FEE_TIERS.length - 1].bps).toBe(BASE_FEE_BPS)
  })
})

describe('feeBpsForActivity — volume AND order-count gate', () => {
  it('elite requires BOTH $10k and 15 orders (anti wash-trading)', () => {
    expect(feeBpsForActivity(1_000_000, 15)).toBe(200)
    expect(feeBpsForActivity(1_000_000, 14)).toBe(300) // count short → drop one tier
    expect(feeBpsForActivity(1_000_000, 9)).toBe(350)
    expect(feeBpsForActivity(1_000_000, 2)).toBe(500)  // too few orders → base
  })
  it('each tier enforces its own volume + count gate', () => {
    expect(feeBpsForActivity(500_000, 10)).toBe(300)
    expect(feeBpsForActivity(300_000, 7)).toBe(350)
    expect(feeBpsForActivity(100_000, 3)).toBe(400)
    expect(feeBpsForActivity(500_000, 3)).toBe(400)  // $5k but 3 orders → tier-2 only
    expect(feeBpsForActivity(50_000, 99)).toBe(500)  // orders high, volume too low
    expect(feeBpsForActivity(100_000, 99)).toBe(400)
  })
  it('garbage volume → BASE; negative/NaN count treated as 0', () => {
    expect(feeBpsForActivity(-1, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(NaN, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(Infinity, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(1_000_000, -5)).toBe(500)
    expect(feeBpsForActivity(1_000_000, NaN)).toBe(500)
  })
})

describe('feeBpsForVolumeCents — deprecated volume-only shim (ignores order gate)', () => {
  it('maps volume bands assuming unlimited orders', () => {
    expect(feeBpsForVolumeCents(0)).toBe(500)
    expect(feeBpsForVolumeCents(99_999)).toBe(500)
    expect(feeBpsForVolumeCents(100_000)).toBe(400)
    expect(feeBpsForVolumeCents(299_999)).toBe(400)
    expect(feeBpsForVolumeCents(300_000)).toBe(350)
    expect(feeBpsForVolumeCents(500_000)).toBe(300)
    expect(feeBpsForVolumeCents(1_000_000)).toBe(200)
    expect(feeBpsForVolumeCents(5_000_000)).toBe(200)
  })
  it('falls back to BASE for negative / non-finite volume', () => {
    expect(feeBpsForVolumeCents(-1)).toBe(BASE_FEE_BPS)
    expect(feeBpsForVolumeCents(NaN)).toBe(BASE_FEE_BPS)
    expect(feeBpsForVolumeCents(Infinity)).toBe(BASE_FEE_BPS)
  })
})

describe('MIN_FEE_CENTS floor ($0.30 per side)', () => {
  it('floors sub-$6 items; leaves larger fees untouched', () => {
    expect(MIN_FEE_CENTS).toBe(30)
    expect(sellerFeeAt(500, 500)).toBe(30)      // 5% of $5 = 25 → 30
    expect(buyerFeeAt(100, 500)).toBe(30)       // 5% of $1 = 5 → 30
    expect(sellerFeeAt(100000, 500)).toBe(5000) // above floor → unchanged
  })
  it('feeAt itself stays raw (generic helper, no floor)', () => {
    expect(feeAt(500, 500)).toBe(25)
    expect(feeAt(10000, 200)).toBe(200)
  })
  it('fee is CAPPED at the item price → seller payout is never negative', () => {
    // 25c item: floor (30) would exceed price → fee capped to 25, payout 0 (not -5).
    expect(sellerFeeAt(25, 500)).toBe(25)
    expect(sellerPayoutAt(25, 500)).toBe(0)
    expect(buyerFeeAt(25, 500)).toBe(25)
    const a = orderAmountsAt(25, 500, 500, 0)
    expect(a.seller_fee_cents).toBe(25)
    expect(a.transfer_cents).toBe(0)          // never negative
    expect(a.transfer_cents).toBeGreaterThanOrEqual(0)
  })
  it('transfer_cents ≥ 0 for every price/rate combo incl. sub-floor items', () => {
    const rates = [200, 300, 350, 400, 500]
    for (const price of [1, 10, 25, 29, 30, 60, 100, 599, 600, 5000]) {
      for (const s of rates) {
        expect(sellerPayoutAt(price, s)).toBeGreaterThanOrEqual(0)
      }
    }
  })
  it('a $10 item at 5% ($0.50) is NOT floored; a $5 item ($0.25) IS', () => {
    const big = orderAmountsAt(1000, 500, 500, 0)
    expect(big.buyer_fee_cents).toBe(50)
    expect(big.seller_fee_cents).toBe(50)
    const small = orderAmountsAt(500, 500, 500, 0)
    expect(small.buyer_fee_cents).toBe(30)
    expect(small.seller_fee_cents).toBe(30)
    expect(small.transfer_cents).toBe(470)
    expect(small.total_cents).toBe(530)
  })
})

describe('tiered fee helpers compose', () => {
  it('sellerPayoutAt / buyerTotalAt', () => {
    expect(sellerFeeAt(100000, 200)).toBe(2000)
    expect(buyerFeeAt(100000, 500)).toBe(5000)
    expect(sellerPayoutAt(100000, 200)).toBe(98000)
    expect(buyerTotalAt(100000, 500)).toBe(105000)
  })
})

describe('orderAmountsAt (per-side tiered, floored)', () => {
  it('applies buyer and seller rates independently', () => {
    // buyer elite (2.0%), seller base (5.0%), $1,000 item
    const a = orderAmountsAt(100000, 200, 500)
    expect(a.item_cents).toBe(100000)
    expect(a.buyer_fee_cents).toBe(2000)
    expect(a.seller_fee_cents).toBe(5000)
    expect(a.shipping_cents).toBe(1200)
    expect(a.total_cents).toBe(103200)  // 100000 + 2000 + 1200
    expect(a.transfer_cents).toBe(95000) // 100000 - 5000
  })
  it('invariants hold across all v2 tier combos', () => {
    const rates = [200, 300, 350, 400, 500]
    for (const price of [1000, 5000, 49999, 125000, 500000]) {
      for (const b of rates) for (const s of rates) {
        const a = orderAmountsAt(price, b, s)
        expect(a.transfer_cents).toBe(a.item_cents - a.seller_fee_cents)
        expect(a.total_cents).toBe(a.item_cents + a.buyer_fee_cents + a.shipping_cents)
        for (const v of Object.values(a)) expect(Number.isInteger(v)).toBe(true)
      }
    }
  })
  it('respects custom shipping', () => {
    const a = orderAmountsAt(100000, 200, 500, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(102000)
  })
})
