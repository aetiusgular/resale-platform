import { describe, it, expect } from 'vitest'
import {
  trailingActivity,
  trailingVolumeCents,
  feeBpsForUser,
  MAX_ORDER_VOLUME_CONTRIBUTION_CENTS,
  COUNTED_STATES,
  TRAILING_DAYS,
  type FeeSide,
} from '../../lib/fee-tier'

type Svc = Parameters<typeof trailingActivity>[0]

/**
 * Minimal fake of the supabase query builder that trailingActivity walks:
 *   from('orders').select('item_cents').eq().gte().not() → { data, error }
 */
function fakeService(rows: Array<{ item_cents: number }> | null, err = false): Svc {
  const builder = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    in: () => Promise.resolve({ data: err ? null : rows, error: err ? new Error('boom') : null }),
  }
  return builder as unknown as Svc
}

describe('fee-tier constants', () => {
  it('365-day window; only delivered/released count; $2,000 order cap', () => {
    expect(TRAILING_DAYS).toBe(365)
    expect([...COUNTED_STATES]).toEqual(['delivered', 'released'])
    expect(MAX_ORDER_VOLUME_CONTRIBUTION_CENTS).toBe(200_000)
  })
})

describe('trailingActivity — $2,000 per-order volume cap, raw count', () => {
  it('one $10k order → $2k volume, 1 order', async () => {
    const a = await trailingActivity(fakeService([{ item_cents: 1_000_000 }]), 'u', 'seller' as FeeSide)
    expect(a.volumeCents).toBe(200_000)
    expect(a.orderCount).toBe(1)
  })
  it('five $3k orders → capped $2k each = $10k over 5 orders', async () => {
    const rows = Array.from({ length: 5 }, () => ({ item_cents: 300_000 }))
    const a = await trailingActivity(fakeService(rows), 'u', 'seller' as FeeSide)
    expect(a.volumeCents).toBe(1_000_000)
    expect(a.orderCount).toBe(5)
  })
  it('null item_cents coerces to 0; count still increments', async () => {
    const rows = [{ item_cents: null as unknown as number }, { item_cents: 5000 }]
    const a = await trailingActivity(fakeService(rows), 'u', 'buyer' as FeeSide)
    expect(a.volumeCents).toBe(5000)
    expect(a.orderCount).toBe(2)
  })
  it('query error → zeroes (fail closed)', async () => {
    const a = await trailingActivity(fakeService(null, true), 'u', 'seller' as FeeSide)
    expect(a).toEqual({ volumeCents: 0, orderCount: 0 })
  })
})

describe('trailingVolumeCents — UNCAPPED gross (compliance / INFORM Act)', () => {
  it('sums FULL item_cents, NOT the $2k tier cap (a $10k sale counts as $10k)', async () => {
    // Regression guard: the tier cap must never shrink the compliance volume,
    // or a high-volume seller would escape mandatory ID verification.
    expect(await trailingVolumeCents(fakeService([{ item_cents: 1_000_000 }]), 'u', 'seller' as FeeSide)).toBe(1_000_000)
  })
  it('two $4k sales → $8k gross (both above the $5k trigger), not capped to $4k', async () => {
    const rows = [{ item_cents: 400_000 }, { item_cents: 400_000 }]
    expect(await trailingVolumeCents(fakeService(rows), 'u', 'seller' as FeeSide)).toBe(800_000)
  })
})

describe('feeBpsForUser — gate integration', () => {
  it('a single $10k order cannot buy a tier (cap + count gate) → base 5.0%', async () => {
    expect(await feeBpsForUser(fakeService([{ item_cents: 1_000_000 }]), 'u', 'seller' as FeeSide)).toBe(500)
  })
  it('15 genuine $2k orders → $10k capped volume + 15 orders → elite 2.0%', async () => {
    const rows = Array.from({ length: 15 }, () => ({ item_cents: 200_000 }))
    expect(await feeBpsForUser(fakeService(rows), 'u', 'seller' as FeeSide)).toBe(200)
  })
  it('$10k volume on 14 orders → tier-4 3.0% (count gate drop)', async () => {
    const rows = Array.from({ length: 14 }, () => ({ item_cents: 200_000 }))
    expect(await feeBpsForUser(fakeService(rows), 'u', 'buyer' as FeeSide)).toBe(300)
  })
  it('no orders → base 5.0%', async () => {
    expect(await feeBpsForUser(fakeService([]), 'u', 'buyer' as FeeSide)).toBe(500)
  })
})
