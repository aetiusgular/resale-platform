import { describe, it, expect } from 'vitest'
import { computeSideDashboard, fmtRate, pickWorseningSide, EXPIRY_WARNING_DAYS } from '../../lib/tier-dashboard'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000
const ago = (days: number) => NOW - days * DAY
// orders each `cents`, all recent (30d old) unless overridden
const recent = (n: number, cents: number) => Array.from({ length: n }, () => ({ createdAtMs: ago(30), itemCents: cents }))

describe('fmtRate', () => {
  it('formats bps as one-decimal percent', () => {
    expect(fmtRate(200)).toBe('2.0%')
    expect(fmtRate(350)).toBe('3.5%')
    expect(fmtRate(500)).toBe('5.0%')
  })
})

describe('computeSideDashboard — tiers & progress', () => {
  it('new user: base 8.0%, next tier 7.0% needs $3000 & 3 orders', () => {
    const d = computeSideDashboard('seller', [], null, null, NOW)
    expect(d.activityBps).toBe(800)
    expect(d.effectiveBps).toBe(800)
    expect(d.current.bps).toBe(800)
    expect(d.next?.bps).toBe(700)
    expect(d.volumeToNextCents).toBe(300_000)
    expect(d.ordersToNext).toBe(3)
    expect(d.locked).toBe(false)
  })

  it('mid tier: $12000 over 12 orders -> 5.5%, next 3.5% needs +$13000 & +3 orders', () => {
    const d = computeSideDashboard('seller', recent(12, 100_000), null, null, NOW) // 12 x $1000 = $12000
    expect(d.volumeCents).toBe(1_200_000)
    expect(d.orderCount).toBe(12)
    expect(d.activityBps).toBe(550)
    expect(d.next?.bps).toBe(350)
    expect(d.volumeToNextCents).toBe(1_300_000)
    expect(d.ordersToNext).toBe(3)
  })

  it('order-count gate: high volume, too few orders -> only orders remain to next', () => {
    // 5 orders x $2000 = $10k volume but only 5 orders -> 7.0% (needs 3), next 5.5% needs 10 orders
    const d = computeSideDashboard('buyer', recent(5, 200_000), null, null, NOW)
    expect(d.activityBps).toBe(700)
    expect(d.next?.bps).toBe(550)
    expect(d.volumeToNextCents).toBe(0) // already past the $10000 volume gate
    expect(d.ordersToNext).toBe(5)      // 10 - 5
  })

  it('per-order cap: a single huge order cannot buy a tier jump', () => {
    const d = computeSideDashboard('seller', [{ createdAtMs: ago(10), itemCents: 5_000_000 }], null, null, NOW)
    expect(d.volumeCents).toBe(200_000) // capped at $2000
    expect(d.orderCount).toBe(1)
    expect(d.activityBps).toBe(800)     // 1 order fails every gate above base
  })

  it('top tier: $30k over 20 orders -> 3.5%, no next tier', () => {
    const d = computeSideDashboard('seller', recent(20, 150_000), null, null, NOW) // 20 x $1500 = $30k
    expect(d.activityBps).toBe(350)
    expect(d.next).toBeNull()
    expect(d.volumeToNextCents).toBe(0)
    expect(d.ordersToNext).toBe(0)
  })
})

describe('computeSideDashboard — lock', () => {
  it('active lock better than activity floors the effective rate and flags locked', () => {
    const d = computeSideDashboard('seller', [], 300, NOW + 5 * DAY, NOW) // activity 800, locked 300
    expect(d.activityBps).toBe(800)
    expect(d.effectiveBps).toBe(300)
    expect(d.locked).toBe(true)
  })

  it('expired lock is ignored', () => {
    const d = computeSideDashboard('seller', [], 300, NOW - DAY, NOW)
    expect(d.effectiveBps).toBe(800)
    expect(d.locked).toBe(false)
  })

  it('lock no better than activity is not flagged as a benefit', () => {
    const d = computeSideDashboard('seller', recent(20, 150_000), 350, NOW + 5 * DAY, NOW) // activity already 350
    expect(d.activityBps).toBe(350)
    expect(d.effectiveBps).toBe(350)
    expect(d.locked).toBe(false)
  })
})

describe('computeSideDashboard — expiring-volume warning', () => {
  it('flags a tier drop when soon-to-expire orders roll off', () => {
    // 3 orders x $1200 = $3600 over 3 orders -> 7.0%. One order is 360d old (expires within 14d).
    const orders = [
      { createdAtMs: ago(30), itemCents: 120_000 },
      { createdAtMs: ago(60), itemCents: 120_000 },
      { createdAtMs: ago(360), itemCents: 120_000 },
    ]
    const d = computeSideDashboard('seller', orders, null, null, NOW)
    expect(d.activityBps).toBe(700)          // $3600 & 3 orders -> $3k tier
    expect(d.expiringOrderCount).toBe(1)
    expect(d.expiringVolumeCents).toBe(120_000)
    expect(d.projectedBps).toBe(800)         // after roll-off: $2400 & 2 orders -> base
    expect(d.willDropTier).toBe(true)
  })

  it('no warning when nothing is near the window edge', () => {
    const d = computeSideDashboard('seller', recent(5, 50_000), null, null, NOW) // all 30d old
    expect(d.expiringOrderCount).toBe(0)
    expect(d.expiringVolumeCents).toBe(0)
    expect(d.willDropTier).toBe(false)
  })

  it('orders already outside the 365d window are excluded entirely', () => {
    const orders = [
      ...recent(3, 40_000),
      { createdAtMs: ago(400), itemCents: 40_000 }, // already expired
    ]
    const d = computeSideDashboard('seller', orders, null, null, NOW)
    expect(d.orderCount).toBe(3)
    expect(d.volumeCents).toBe(120_000)
  })

  it('EXPIRY_WARNING_DAYS is 14', () => {
    expect(EXPIRY_WARNING_DAYS).toBe(14)
  })
})

describe('pickWorseningSide', () => {
  const expiringSeller = () => computeSideDashboard('seller', [
    { createdAtMs: ago(30), itemCents: 120_000 },
    { createdAtMs: ago(60), itemCents: 120_000 },
    { createdAtMs: ago(360), itemCents: 120_000 },
  ], null, null, NOW) // 7.0% -> base after roll-off
  const expiringBuyer = () => computeSideDashboard('buyer', [
    { createdAtMs: ago(30), itemCents: 120_000 },
    { createdAtMs: ago(60), itemCents: 120_000 },
    { createdAtMs: ago(360), itemCents: 120_000 },
  ], null, null, NOW)
  const stableBuyer = () => computeSideDashboard('buyer', recent(5, 50_000), null, null, NOW) // 3.0%, nothing expiring

  it('returns null when neither side will drop', () => {
    expect(pickWorseningSide(stableBuyer(), stableBuyer())).toBeNull()
  })

  it('returns the dropping side', () => {
    const w = pickWorseningSide(expiringSeller(), stableBuyer())
    expect(w?.side).toBe('seller')
    expect(w?.willDropTier).toBe(true)
  })

  it('equal rate increase on both sides breaks the tie toward seller', () => {
    const w = pickWorseningSide(expiringSeller(), expiringBuyer())
    expect(w?.side).toBe('seller')
  })
})
