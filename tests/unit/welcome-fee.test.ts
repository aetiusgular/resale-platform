import { describe, it, expect } from 'vitest'
import {
  WELCOME_SALES,
  STRIPE_PCT_BPS,
  STRIPE_FIXED_CENTS,
  MIN_FEE_CENTS,
  resolveFeeMode,
  welcomeSellerFeeCents,
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
  it('equals the 2.9% + $0.30 processing estimate on item + shipping', () => {
    const item = 10000, ship = 900
    const expected = feeAt(item + ship, STRIPE_PCT_BPS) + STRIPE_FIXED_CENTS
    expect(welcomeSellerFeeCents(item, ship)).toBe(expected)
  })
  it('is never negative and never exceeds the item price (payout stays >= 0)', () => {
    for (const item of [0, 1, 30, 100, 5000, 500000]) {
      for (const ship of [0, 900, 5000]) {
        const fee = welcomeSellerFeeCents(item, ship)
        expect(fee).toBeGreaterThanOrEqual(0)
        expect(fee).toBeLessThanOrEqual(item)
        expect(Number.isInteger(fee)).toBe(true)
      }
    }
  })
  it('is floored at MIN_FEE_CENTS on tiny items', () => {
    // item so small the cap bites: fee capped at item, but still an integer >= 0
    expect(welcomeSellerFeeCents(10, 0)).toBe(10) // capped at the $0.10 item
    expect(welcomeSellerFeeCents(100000, 0)).toBeGreaterThanOrEqual(MIN_FEE_CENTS)
  })
  it('welcome fee is strictly less than the base 8% tier fee on a normal order', () => {
    const item = 20000, ship = 1200
    const welcome = welcomeSellerFeeCents(item, ship)
    const tier8pct = feeAt(item, 800)
    expect(welcome).toBeLessThan(tier8pct) // ~2.9%+30c < 8% → seller keeps more early
  })
})
