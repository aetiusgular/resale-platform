import { describe, it, expect } from 'vitest'
import { resolveEffectiveBps, applyTierProgress } from '../../lib/tier-progress'
import type { FeeSide } from '../../lib/fee-tier'

type Svc = Parameters<typeof resolveEffectiveBps>[0]

/**
 * Fake service covering the two chains tier-progress walks:
 *   orders:   from().select().eq().gte().not()  → { data: rows }   (trailingActivity)
 *   profiles: from().select().eq().single()      → { data: row }
 *             from().update().eq()                → captured write
 */
function fakeService(opts: {
  orderRows: Array<{ item_cents: number }>
  profile: Record<string, unknown> | null
}): { svc: Svc; writes: Array<Record<string, unknown>> } {
  const writes: Array<Record<string, unknown>> = []
  const ordersBuilder = {
    select: () => ordersBuilder,
    eq: () => ordersBuilder,
    gte: () => ordersBuilder,
    in: () => Promise.resolve({ data: opts.orderRows, error: null }),
  }
  const profilesBuilder = {
    select: () => profilesBuilder,
    eq: () => profilesBuilder,
    single: () => Promise.resolve({ data: opts.profile, error: null }),
    update: (patch: Record<string, unknown>) => {
      writes.push(patch)
      return { eq: () => Promise.resolve({ data: null, error: null }) }
    },
  }
  const svc = {
    from: (table: string) => (table === 'orders' ? ordersBuilder : profilesBuilder),
  }
  return { svc: svc as unknown as Svc, writes }
}

describe('resolveEffectiveBps (checkout)', () => {
  it('no stored lock → pure activity rate', async () => {
    const { svc } = fakeService({
      orderRows: Array.from({ length: 15 }, () => ({ item_cents: 200_000 })), // $30k capped, 15 orders → 350
      profile: { current_buyer_tier_bps: null, buyer_tier_locked_until: null },
    })
    expect(await resolveEffectiveBps(svc, 'u', 'buyer' as FeeSide)).toBe(350)
  })
  it('active lock better than current activity → locked rate wins (grace)', async () => {
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString()
    const { svc } = fakeService({
      orderRows: [], // activity dropped to base 500
      profile: { current_seller_tier_bps: 200, seller_tier_locked_until: future },
    })
    expect(await resolveEffectiveBps(svc, 'u', 'seller' as FeeSide)).toBe(200)
  })
  it('expired lock → activity rate', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const { svc } = fakeService({
      orderRows: [],
      profile: { current_seller_tier_bps: 350, seller_tier_locked_until: past },
    })
    expect(await resolveEffectiveBps(svc, 'u', 'seller' as FeeSide)).toBe(800)
  })
})

describe('applyTierProgress (order completion — rolling lock)', () => {
  const future = () => new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString()
  const past = () => new Date(Date.now() - 1000).toISOString()

  it('upgrade (no active lock) → writes new bps + a ~30-day lock', async () => {
    const { svc, writes } = fakeService({
      orderRows: Array.from({ length: 15 }, () => ({ item_cents: 200_000 })), // → 350
      profile: { current_seller_tier_bps: 800, seller_tier_locked_until: null },
    })
    await applyTierProgress(svc, 'u', 'seller' as FeeSide)
    expect(writes).toHaveLength(1)
    expect(writes[0].current_seller_tier_bps).toBe(350)
    expect(typeof writes[0].seller_tier_locked_until).toBe('string')
  })
  it('active better lock + WORSE activity → NO write (grace preserved, not extended)', async () => {
    const { svc, writes } = fakeService({
      orderRows: [], // activity base 500
      profile: { current_seller_tier_bps: 200, seller_tier_locked_until: future() },
    })
    await applyTierProgress(svc, 'u', 'seller' as FeeSide)
    expect(writes).toHaveLength(0)
  })
  it('active lock + SAME tier → refreshes (rolling 30-day)', async () => {
    const { svc, writes } = fakeService({
      orderRows: Array.from({ length: 15 }, () => ({ item_cents: 200_000 })), // → 350
      profile: { current_seller_tier_bps: 350, seller_tier_locked_until: future() },
    })
    await applyTierProgress(svc, 'u', 'seller' as FeeSide)
    expect(writes).toHaveLength(1)
    expect(writes[0].current_seller_tier_bps).toBe(350)
  })
  it('EXPIRED lock with stale better bps + re-earned lower tier → relocks (the #3 fix)', async () => {
    const { svc, writes } = fakeService({
      orderRows: Array.from({ length: 7 }, () => ({ item_cents: 200_000 })), // $14k/7 orders → $1k tier 700
      profile: { current_seller_tier_bps: 350, seller_tier_locked_until: past() },
    })
    await applyTierProgress(svc, 'u', 'seller' as FeeSide)
    expect(writes).toHaveLength(1)
    expect(writes[0].current_seller_tier_bps).toBe(700)
  })
  it('first-ever (null bps) → writes current activity + lock', async () => {
    const { svc, writes } = fakeService({
      orderRows: [{ item_cents: 5000 }], // base 800
      profile: { current_buyer_tier_bps: null, buyer_tier_locked_until: null },
    })
    await applyTierProgress(svc, 'u', 'buyer' as FeeSide)
    expect(writes).toHaveLength(1)
    expect(writes[0].current_buyer_tier_bps).toBe(800)
  })
})
