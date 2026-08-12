import { describe, it, expect } from 'vitest'
import { REWARD_TIERS, rewardDiscountCents, milestonesToGrant, milestoneLabel } from '../../lib/rewards-core'

describe('REWARD_TIERS', () => {
  it('are $10k→15%/$300, $5k→10%/$150, $1k→5%/$50 (richest first)', () => {
    expect(REWARD_TIERS.map(t => t.milestoneCents)).toEqual([1_000_000, 500_000, 100_000])
    expect(REWARD_TIERS.map(t => t.bps)).toEqual([1500, 1000, 500])
    expect(REWARD_TIERS.map(t => t.capCents)).toEqual([30_000, 15_000, 5_000])
  })
})

describe('rewardDiscountCents', () => {
  it('is price·bps, capped, never negative', () => {
    expect(rewardDiscountCents(100_000, 500, 5_000)).toBe(5_000)
    expect(rewardDiscountCents(100_000, 1000, 15_000)).toBe(10_000)
    expect(rewardDiscountCents(500_000, 1500, 30_000)).toBe(30_000)
    expect(rewardDiscountCents(0, 500, 5_000)).toBe(0)
    expect(rewardDiscountCents(-100, 500, 5_000)).toBe(0)
  })
})

describe('milestonesToGrant', () => {
  it('grants every met, ungranted milestone (richest first)', () => {
    expect(milestonesToGrant(150_000, []).map(t => t.milestoneCents)).toEqual([100_000])
    expect(milestonesToGrant(600_000, []).map(t => t.milestoneCents)).toEqual([500_000, 100_000])
    expect(milestonesToGrant(1_200_000, []).map(t => t.milestoneCents)).toEqual([1_000_000, 500_000, 100_000])
  })
  it('excludes milestones already granted in the rolling window', () => {
    expect(milestonesToGrant(600_000, [100_000]).map(t => t.milestoneCents)).toEqual([500_000])
    expect(milestonesToGrant(600_000, [500_000, 100_000])).toEqual([])
  })
  it('grants nothing below the first milestone or on garbage volume', () => {
    expect(milestonesToGrant(99_999, [])).toEqual([])
    expect(milestonesToGrant(0, [])).toEqual([])
    expect(milestonesToGrant(NaN, [])).toEqual([])
  })
})

describe('milestoneLabel', () => {
  it('formats dollars', () => {
    expect(milestoneLabel(100_000)).toBe('$1,000')
    expect(milestoneLabel(1_000_000)).toBe('$10,000')
  })
})
