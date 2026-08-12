import { describe, it, expect } from 'vitest'
import { BOOST_PACKAGES, boostPackage, applyBoostOrder, MAX_PROMOTED_PER_PAGE } from '../../lib/boosts'

describe('BOOST_PACKAGES', () => {
  it('are 3/7/14-day at $6/$12/$20', () => {
    expect(BOOST_PACKAGES.map(p => p.durationDays)).toEqual([3, 7, 14])
    expect(BOOST_PACKAGES.map(p => p.amountCents)).toEqual([600, 1200, 2000])
  })
  it('boostPackage resolves by key, undefined for unknown', () => {
    expect(boostPackage('feature_7')?.amountCents).toBe(1200)
    expect(boostPackage('nope')).toBeUndefined()
  })
})

describe('applyBoostOrder', () => {
  const L = (id: string, promoted = false) => ({ id, promoted })
  it('moves up to cap promoted items to the front, preserving order', () => {
    const out = applyBoostOrder([L('a', true), L('b'), L('c', true), L('d', true)], 2)
    expect(out.map(x => x.id)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('is a no-op (new array) when nothing is promoted', () => {
    const input = [L('a'), L('b'), L('c')]
    const out = applyBoostOrder(input, 2)
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(input)
  })
  it('preserves every item exactly once', () => {
    const out = applyBoostOrder([L('a'), L('b', true), L('c'), L('d', true)], MAX_PROMOTED_PER_PAGE)
    expect(new Set(out.map(x => x.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(out).toHaveLength(4)
    expect(out[0].id).toBe('b')
    expect(out[1].id).toBe('d')
  })
  it('defaults the cap to MAX_PROMOTED_PER_PAGE (2)', () => {
    expect(MAX_PROMOTED_PER_PAGE).toBe(2)
    const out = applyBoostOrder([L('a', true), L('b', true), L('c', true)])
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
})
