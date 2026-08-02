import { describe, it, expect } from 'vitest'
import {
  bumpEligibility,
  canBump,
  priceDropPct,
  BUMP_COOLDOWN_MS,
  PRICE_DROP_BUMP_MIN_PCT,
  type BumpInput,
} from '../../lib/bump/eligibility'

const NOW = 1_800_000_000_000 // fixed epoch ms for determinism
const DAY = 24 * 60 * 60 * 1000

describe('priceDropPct', () => {
  it('computes a positive percent only on a decrease', () => {
    expect(priceDropPct(10000, 9000)).toBeCloseTo(10)
    expect(priceDropPct(10000, 7500)).toBeCloseTo(25)
  })
  it('returns 0 when price did not decrease', () => {
    expect(priceDropPct(10000, 10000)).toBe(0)
    expect(priceDropPct(10000, 12000)).toBe(0)
  })
  it('fail-safe on unusable inputs (never negative / NaN)', () => {
    expect(priceDropPct(0, 5000)).toBe(0)
    expect(priceDropPct(-1, 5000)).toBe(0)
    expect(priceDropPct(Number.NaN, 5000)).toBe(0)
    expect(priceDropPct(10000, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('bumpEligibility', () => {
  it('first bump: never bumped → eligible', () => {
    const input: BumpInput = { nowMs: NOW, bumpedAtMs: null, currentPriceCents: 10000, priceAtLastBumpCents: null }
    expect(bumpEligibility(input)).toEqual({ ok: true, reason: 'first_bump' })
  })

  it('cooldown elapsed: ≥7 days since last bump → eligible (boundary inclusive)', () => {
    const exactly7d: BumpInput = {
      nowMs: NOW,
      bumpedAtMs: NOW - BUMP_COOLDOWN_MS,
      currentPriceCents: 10000,
      priceAtLastBumpCents: 10000,
    }
    expect(bumpEligibility(exactly7d)).toEqual({ ok: true, reason: 'cooldown_elapsed' })
  })

  it('within cooldown, no price drop → not eligible + next-eligible time', () => {
    const bumpedAt = NOW - 2 * DAY
    const e = bumpEligibility({ nowMs: NOW, bumpedAtMs: bumpedAt, currentPriceCents: 10000, priceAtLastBumpCents: 10000 })
    expect(e.ok).toBe(false)
    if (!e.ok) {
      expect(e.reason).toBe('cooldown_active')
      expect(e.nextEligibleAtMs).toBe(bumpedAt + BUMP_COOLDOWN_MS)
      expect(e.qualifyingPriceDropPct).toBe(PRICE_DROP_BUMP_MIN_PCT)
    }
  })

  it('within cooldown, ≥10% markdown from last-bump price → early bump', () => {
    const e = bumpEligibility({
      nowMs: NOW,
      bumpedAtMs: NOW - 1 * DAY,
      currentPriceCents: 9000, // 10% below 10000
      priceAtLastBumpCents: 10000,
    })
    expect(e).toEqual({ ok: true, reason: 'price_drop' })
  })

  it('within cooldown, drop just under 10% → still not eligible', () => {
    expect(
      canBump({ nowMs: NOW, bumpedAtMs: NOW - 1 * DAY, currentPriceCents: 9001, priceAtLastBumpCents: 10000 }),
    ).toBe(false)
  })

  it('price-drop path is self-limiting: after an early bump, another needs a fresh 10% off the reduced price', () => {
    // First early bump happened at 9000 (10% off 10000). To early-bump again while
    // still in cooldown, the reference is now 9000 — 8999 is not enough.
    expect(
      canBump({ nowMs: NOW, bumpedAtMs: NOW - 1 * DAY, currentPriceCents: 8999, priceAtLastBumpCents: 9000 }),
    ).toBe(false)
    // ...but a real further 10% cut (to 8100) qualifies again.
    expect(
      canBump({ nowMs: NOW, bumpedAtMs: NOW - 1 * DAY, currentPriceCents: 8100, priceAtLastBumpCents: 9000 }),
    ).toBe(true)
  })

  it('a price increase never qualifies an early bump', () => {
    expect(
      canBump({ nowMs: NOW, bumpedAtMs: NOW - 1 * DAY, currentPriceCents: 12000, priceAtLastBumpCents: 10000 }),
    ).toBe(false)
  })
})
