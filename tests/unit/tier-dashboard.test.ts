import { describe, it, expect } from 'vitest'
import { computeSideDashboard, fmtRate, EXPIRY_WARNING_DAYS } from '../../lib/tier-dashboard'

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
  it('new user: base 5.0%, next tier 4.0% needs $1000 & 3 orders', () => {
    const d = computeSideDashboard('seller', [], null, null, NOW)
    expect(d.activityBps).toBe(500)
    expect(d.effectiveBps).toBe(500)
    expect(d.current.bps).toBe(500)
    expect(d.next?.bps).toBe(400)
    expect(d.volumeToNextCents).toBe(100_000)
    expect(d.ordersToNext).toBe(3)
    expect(d.locked).toBe(false)
  })

  it('mid tier: $6000 over 12 orders -> 3.0%, next 2.0% needs +$4000 & +3 orders', () => {
    const d = computeSideDashboard('seller', recent(12, 50_000), null, null, NOW) // 12 x $500 = $6000
    expect(d.volumeCents).toBe(600_000)
    expect(d.orderCount).toBe(12)
    expect(d.activityBps).toBe(300)
    expect(d.next?.bps).toBe(200)
    expect(d.volumeToNextCents).toBe(400_000)
    expect(d.ordersToNext).toBe(3)
  })

  it('order-count gate: high volume, too few orders -> only orders remain to next', () => {
    // 5 orders x $2000 = $10k volume but only 5 orders -> 4.0% (needs 3), next 3.5% needs 7 orders
    const d = computeSideDashboard('buyer', recent(5, 200_000), null, null, NOW)
    expect(d.activityBps).toBe(400)
    expect(d.next?.bps).toBe(350)
    expect(d.volumeToNextCents).toBe(0) // already past the $3000 volume gate
    expect(d.ordersToNext).toBe(2)      // 7 - 5
  })

  it('per-order cap: a single huge order cannot buy a tier jump', () => {
    const d = computeSideDashboard('seller', [{ createdAtMs: ago(10), itemCents: 5_000_000 }], null, null, NOW)
    expect(d.volumeCents).toBe(200_000) // capped at $2000
    expect(d.orderCount).toBe(1)
    expect(d.activityBps).toBe(500)     // 1 order fails every gate above base
  })

  it('top tier: $12k over 20 orders -> 2.0%, no next tier', () => {
    const d = computeSideDashboard('seller', recent(20, 60_000), null, null, NOW) // 20 x $600 = $12k
    expect(d.activityBps).toBe(200)
    expect(d.next).toBeNull()
    expect(d.volumeToNextCents).toBe(0)
    expect(d.ordersToNext).toBe(0)
  })
})

describe('computeSideDashboard — lock', () => {
  it('active lock better than activity floors the effective rate and flags locked', () => {
    const d = computeSideDashboard('seller', [], 300, NOW + 5 * DAY, NOW) // activity 500, locked 300
    expect(d.activityBps).toBe(500)
    expect(d.effectiveBps).toBe(300)
    expect(d.locked).toBe(true)
  })

  it('expired lock is ignored', () => {
    const d = computeSideDashboard('seller', [], 300, NOW - DAY, NOW)
    expect(d.effectiveBps).toBe(500)
    expect(d.locked).toBe(false)
  })

  it('lock no better than activity is not flagged as a benefit', () => {
    const d = computeSideDashboard('seller', recent(20, 60_000), 200, NOW + 5 * DAY, NOW) // activity already 200
    expect(d.activityBps).toBe(200)
    expect(d.effectiveBps).toBe(200)
    expect(d.locked).toBe(false)
  })
})

describe('computeSideDashboard — expiring-volume warning', () => {
  it('flags a tier drop when soon-to-expire orders roll off', () => {
    // 3 orders x $400 = $1200 over 3 orders -> 4.0%. One order is 360d old (expires within 14d).
    const orders = [
      { createdAtMs: ago(30), itemCents: 40_000 },
      { createdAtMs: ago(60), itemCents: 40_000 },
      { createdAtMs: ago(360), itemCents: 40_000 },
    ]
    const d = computeSideDashboard('seller', orders, null, null, NOW)
    expect(d.activityBps).toBe(400)          // $1200 & 3 orders
    expect(d.expiringOrderCount).toBe(1)
    expect(d.expiringVolumeCents).toBe(40_000)
    expect(d.projectedBps).toBe(500)         // after roll-off: $800 & 2 orders -> base
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
