import { describe, it, expect } from 'vitest'
import {
  formatCents,
  FEE_TIERS,
  BASE_FEE_BPS,
  BUYER_FEE_BPS,
  MIN_FEE_CENTS,
  SMALL_ORDER_THRESHOLD_CENTS,
  SMALL_ORDER_CAP_BPS,
  effectiveSellerBps,
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

// ─── Fee Model v3: seller-only tiers, zero buyer fee, sub-$100 cap ───────────

describe('FEE_TIERS + BASE_FEE_BPS (v3: 8→7→5.5→3.5)', () => {
  it('base is 8.0% and tiers descend 350→800 with volume + order gates', () => {
    expect(BASE_FEE_BPS).toBe(800)
    expect(FEE_TIERS.map(t => t.bps)).toEqual([350, 550, 700, 800])
    expect(FEE_TIERS.map(t => t.minVolumeCents)).toEqual([2_500_000, 1_000_000, 300_000, 0])
    expect(FEE_TIERS.map(t => t.minOrders)).toEqual([15, 10, 3, 0])
  })
  it('richest-first: volume strictly decreasing, bps non-decreasing, base floor at 0', () => {
    for (let i = 1; i < FEE_TIERS.length; i++) {
      expect(FEE_TIERS[i].minVolumeCents).toBeLessThan(FEE_TIERS[i - 1].minVolumeCents)
      expect(FEE_TIERS[i].bps).toBeGreaterThanOrEqual(FEE_TIERS[i - 1].bps)
    }
    expect(FEE_TIERS[FEE_TIERS.length - 1].minVolumeCents).toBe(0)
    expect(FEE_TIERS[FEE_TIERS.length - 1].bps).toBe(BASE_FEE_BPS)
  })
})

describe('feeBpsForActivity — volume AND order-count gate (both-gates kept)', () => {
  it('elite requires BOTH $25k and 15 orders', () => {
    expect(feeBpsForActivity(2_500_000, 15)).toBe(350)
    expect(feeBpsForActivity(2_500_000, 14)).toBe(550) // count short → drop a tier
    expect(feeBpsForActivity(2_500_000, 9)).toBe(700)
    expect(feeBpsForActivity(2_500_000, 2)).toBe(800)  // too few orders → base
  })
  it('each tier enforces its own volume + count gate', () => {
    expect(feeBpsForActivity(1_000_000, 10)).toBe(550)
    expect(feeBpsForActivity(300_000, 3)).toBe(700)
    expect(feeBpsForActivity(1_000_000, 3)).toBe(700)  // $10k but 3 orders → $3k tier only
    expect(feeBpsForActivity(50_000, 99)).toBe(800)  // orders high, volume too low
    expect(feeBpsForActivity(300_000, 99)).toBe(700)
  })
  it('garbage volume → BASE; negative/NaN count treated as 0', () => {
    expect(feeBpsForActivity(-1, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(NaN, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(Infinity, 15)).toBe(BASE_FEE_BPS)
    expect(feeBpsForActivity(1_000_000, -5)).toBe(800)
    expect(feeBpsForActivity(1_000_000, NaN)).toBe(800)
  })
})

describe('feeBpsForVolumeCents — deprecated volume-only shim (ignores order gate)', () => {
  it('maps the v3 volume bands assuming unlimited orders', () => {
    expect(feeBpsForVolumeCents(0)).toBe(800)
    expect(feeBpsForVolumeCents(299_999)).toBe(800)
    expect(feeBpsForVolumeCents(300_000)).toBe(700)
    expect(feeBpsForVolumeCents(999_999)).toBe(700)
    expect(feeBpsForVolumeCents(1_000_000)).toBe(550)
    expect(feeBpsForVolumeCents(2_499_999)).toBe(550)
    expect(feeBpsForVolumeCents(2_500_000)).toBe(350)
    expect(feeBpsForVolumeCents(5_000_000)).toBe(350)
  })
  it('falls back to BASE for negative / non-finite volume', () => {
    expect(feeBpsForVolumeCents(-1)).toBe(BASE_FEE_BPS)
    expect(feeBpsForVolumeCents(NaN)).toBe(BASE_FEE_BPS)
  })
})

describe('BUYER_FEE_BPS + buyerFeeAt — zero buyer fee (v3)', () => {
  it('buyers pay no platform fee at any price or rate', () => {
    expect(BUYER_FEE_BPS).toBe(0)
    expect(buyerFeeAt(100000, 500)).toBe(0)
    expect(buyerFeeAt(25, 800)).toBe(0)
    expect(buyerFeeAt()).toBe(0)
    expect(buyerTotalAt(100000, 0)).toBe(100000) // price + 0
  })
})

describe('effectiveSellerBps — sub-$100 cap at 5%', () => {
  it('caps orders under $100 at the lower of tier rate or 5%', () => {
    expect(SMALL_ORDER_THRESHOLD_CENTS).toBe(10_000)
    expect(SMALL_ORDER_CAP_BPS).toBe(500)
    expect(effectiveSellerBps(800, 5000)).toBe(500)  // base 8% → 5% on a $50 item
    expect(effectiveSellerBps(700, 9999)).toBe(500)  // $99.99 still capped
    expect(effectiveSellerBps(550, 5000)).toBe(500)  // 5.5% → 5%
    expect(effectiveSellerBps(350, 5000)).toBe(350)  // elite already below cap → unchanged
  })
  it('leaves orders at/above $100 at their full tier rate', () => {
    expect(effectiveSellerBps(800, 10_000)).toBe(800)
    expect(effectiveSellerBps(800, 250000)).toBe(800)
    expect(effectiveSellerBps(350, 10_000)).toBe(350)
  })
})

describe('MIN_FEE_CENTS floor ($0.30, seller side)', () => {
  it('floors small seller fees; leaves larger untouched', () => {
    expect(MIN_FEE_CENTS).toBe(30)
    expect(sellerFeeAt(500, 500)).toBe(30)       // 5% of $5 = 25 → 30
    expect(sellerFeeAt(100000, 800)).toBe(8000)  // above floor → unchanged
  })
  it('feeAt itself stays raw (no floor)', () => {
    expect(feeAt(500, 500)).toBe(25)
    expect(feeAt(10000, 350)).toBe(350)
  })
  it('fee is capped at item price → payout never negative', () => {
    expect(sellerFeeAt(25, 500)).toBe(25)
    expect(sellerPayoutAt(25, 500)).toBe(0)
    const a = orderAmountsAt(25, 800, 1200)
    expect(a.seller_fee_cents).toBe(25)  // sub-$100 → 5% cap, then floored/capped to price
    expect(a.transfer_cents).toBe(0)
    expect(a.transfer_cents).toBeGreaterThanOrEqual(0)
  })
})

describe('orderAmountsAt (v3: zero buyer fee, sub-$100 cap, platform-funded discount)', () => {
  it('$1,000 item at base 8% seller rate', () => {
    const a = orderAmountsAt(100000, 800, 1200)
    expect(a.item_cents).toBe(100000)
    expect(a.buyer_fee_cents).toBe(0)
    expect(a.seller_fee_cents).toBe(8000)
    expect(a.shipping_cents).toBe(1200)
    expect(a.discount_cents).toBe(0)
    expect(a.total_cents).toBe(101200)   // price + shipping, no buyer fee
    expect(a.transfer_cents).toBe(92000) // price - seller fee
  })
  it('$1,000 item at elite 3.5% seller rate', () => {
    const a = orderAmountsAt(100000, 350, 1200)
    expect(a.seller_fee_cents).toBe(3500)
    expect(a.transfer_cents).toBe(96500)
    expect(a.total_cents).toBe(101200)
  })
  it('sub-$100 order is charged 5% (base seller) not 8%', () => {
    const a = orderAmountsAt(5000, 800, 1200) // $50 item
    expect(a.seller_fee_cents).toBe(250) // 5% of $50
    expect(a.transfer_cents).toBe(4750)
    expect(a.total_cents).toBe(6200)     // 5000 + 1200
  })
  it('sub-$100 order for an elite seller keeps the lower 3.5%', () => {
    const a = orderAmountsAt(5000, 350, 1200)
    expect(a.seller_fee_cents).toBe(175)
    expect(a.transfer_cents).toBe(4825)
  })
  it('buyer discount reduces only the buyer total, never the seller transfer', () => {
    const a = orderAmountsAt(100000, 800, 1200, 5000)
    expect(a.discount_cents).toBe(5000)
    expect(a.total_cents).toBe(96200)    // 101200 - 5000
    expect(a.transfer_cents).toBe(92000) // unchanged — platform funds the discount
  })
  it('discount is clamped to the gross (never negative total)', () => {
    const a = orderAmountsAt(1000, 800, 0, 99999)
    expect(a.discount_cents).toBe(1000)
    expect(a.total_cents).toBe(0)
  })
  it('respects custom / free shipping (offers)', () => {
    const a = orderAmountsAt(100000, 350, 0)
    expect(a.shipping_cents).toBe(0)
    expect(a.total_cents).toBe(100000)
  })
  it('invariants hold across all v3 tiers, prices, and discounts', () => {
    const rates = [350, 550, 700, 800]
    for (const price of [500, 5000, 9999, 10000, 49999, 125000, 500000]) {
      for (const s of rates) {
        for (const disc of [0, 500, 999999]) {
          const a = orderAmountsAt(price, s, 1200, disc)
          expect(a.buyer_fee_cents).toBe(0)
          expect(a.transfer_cents).toBe(a.item_cents - a.seller_fee_cents)
          expect(a.transfer_cents).toBeGreaterThanOrEqual(0)
          expect(a.total_cents).toBe(a.item_cents + a.shipping_cents - a.discount_cents)
          expect(a.total_cents).toBeGreaterThanOrEqual(0)
          for (const v of Object.values(a)) expect(Number.isInteger(v)).toBe(true)
        }
      }
    }
  })
})
