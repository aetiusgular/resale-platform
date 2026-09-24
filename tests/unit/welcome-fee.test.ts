import { describe, it, expect } from 'vitest'
import {
  WELCOME_SALES,
  STRIPE_PCT_BPS,
  STRIPE_FIXED_CENTS,
  MIN_FEE_CENTS,
  resolveFeeMode,
  welcomeSellerFeeCents,
  sellerFeeBreakdown,
  transferCentsFor,
  buyerChargeCents,
  feeAt,
} from '../../lib/fees'

describe('resolveFeeMode', () => {
  it('welcome for the first WELCOME_SALES sales (0..9)', () => {
    for (let n = 0; n < WELCOME_SALES; n++) expect(resolveFeeMode(n)).toBe('welcome')
  })
  it('graduates to tier at exactly WELCOME_SALES prior orders', () => {
    expect(resolveFeeMode(WELCOME_SALES)).toBe('tier')     // 10th completed → 11th sale is tier
    expect(resolveFeeMode(WELCOME_SALES + 5)).toBe('tier')
  })
  it('treats garbage / negative input as zero prior orders (welcome)', () => {
    for (const n of [-1, -100, NaN, Infinity, -Infinity]) {
      expect(resolveFeeMode(n as number)).toBe('welcome')
    }
  })
  it('floors fractional counts', () => {
    expect(resolveFeeMode(9.9)).toBe('welcome')
    expect(resolveFeeMode(10.1)).toBe('tier')
  })
})

describe('welcomeSellerFeeCents', () => {
  it('equals the 2.9% + $0.30 processing cost on the ITEM price only', () => {
    const item = 10000
    const expected = feeAt(item, STRIPE_PCT_BPS) + STRIPE_FIXED_CENTS
    expect(welcomeSellerFeeCents(item)).toBe(expected)
    expect(welcomeSellerFeeCents(24000)).toBe(726) // $240 → $6.96 + $0.30
  })
  it('never charges the seller for shipping', () => {
    for (const ship of [0, 900, 5000, 99999]) {
      expect(welcomeSellerFeeCents(10000, ship)).toBe(welcomeSellerFeeCents(10000))
    }
  })
  it('is never negative and never exceeds the item price (payout stays >= 0)', () => {
    for (const item of [0, 1, 30, 100, 5000, 500000]) {
      const fee = welcomeSellerFeeCents(item)
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(fee).toBeLessThanOrEqual(item)
      expect(Number.isInteger(fee)).toBe(true)
    }
  })
  it('caps at the item on tiny items and carries the fixed fee otherwise', () => {
    expect(welcomeSellerFeeCents(10)).toBe(10) // capped at the $0.10 item
    expect(welcomeSellerFeeCents(100000)).toBeGreaterThanOrEqual(MIN_FEE_CENTS)
  })
  it('welcome fee is strictly less than the base 8% tier fee on a normal order', () => {
    const item = 20000
    expect(welcomeSellerFeeCents(item)).toBeLessThan(feeAt(item, 800))
  })
})

describe('sellerFeeBreakdown (the listing form take-home box)', () => {
  it('welcome: tier fee is shown, waived by the ramp, and processing is charged', () => {
    const b = sellerFeeBreakdown(24000, 800, 'welcome')
    expect(b.tierFeeCents).toBe(1950)      // 8% + 30¢
    expect(b.waivedCents).toBe(1950)
    expect(b.processingCents).toBe(726)    // 2.9% + 30¢
    expect(b.feeCents).toBe(726)
    expect(b.payoutCents).toBe(23274)      // $232.74
  })
  it('tier: 8% + 30¢ comes off, nothing waived', () => {
    const b = sellerFeeBreakdown(24000, 800, 'tier')
    expect(b.feeCents).toBe(1950)
    expect(b.waivedCents).toBe(0)
    expect(b.processingCents).toBe(0)
    expect(b.payoutCents).toBe(22050)      // $220.50
  })
  it('applies the sub-$100 cap exactly like checkout', () => {
    const b = sellerFeeBreakdown(5000, 800, 'tier')
    expect(b.tierBps).toBe(500)
    expect(b.feeCents).toBe(280)
  })
  it('zero price shows zero everywhere', () => {
    const b = sellerFeeBreakdown(0, 800, 'welcome')
    expect(b.feeCents).toBe(0)
    expect(b.payoutCents).toBe(0)
  })
})

describe('transferCentsFor', () => {
  it('platform-label orders keep shipping on the platform (it pays the prepaid label)', () => {
    expect(transferCentsFor({ itemCents: 24000, sellerFeeCents: 726, shippingCents: 1700, labelMode: 'platform' })).toBe(23274)
  })
  it('seller-label (international) orders pay the shipping line out to the seller', () => {
    expect(transferCentsFor({ itemCents: 24000, sellerFeeCents: 726, shippingCents: 4000, labelMode: 'seller' })).toBe(27274)
  })
  it('never goes negative', () => {
    expect(transferCentsFor({ itemCents: 10, sellerFeeCents: 50, shippingCents: 0, labelMode: 'platform' })).toBe(0)
  })
})

describe('buyerChargeCents (checkout re-pricing a new destination)', () => {
  it('item + buyer fee + shipping − discount', () => {
    expect(buyerChargeCents({ itemCents: 24000, buyerFeeCents: 0, shippingCents: 4000, discountCents: 1000 })).toEqual({ totalCents: 27000, discountCents: 1000 })
  })
  it('clamps the discount to the gross', () => {
    expect(buyerChargeCents({ itemCents: 500, buyerFeeCents: 0, shippingCents: 0, discountCents: 9999 })).toEqual({ totalCents: 0, discountCents: 500 })
  })
})
