import { describe, it, expect } from 'vitest'
import { applyFeedOrder } from '../../lib/recs/rank'

const L = (id: string) => ({ id, n: id })

describe('applyFeedOrder', () => {
  it('returns a new array in original order when the feed is empty', () => {
    const items = [L('a'), L('b'), L('c')]
    const out = applyFeedOrder(items, [])
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(items) // new array
  })

  it('moves feed items to the front in feed order, tail keeps default order', () => {
    const items = [L('a'), L('b'), L('c'), L('d')]
    const out = applyFeedOrder(items, ['c', 'a'])
    expect(out.map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('ignores feed ids that are not on the current page', () => {
    const items = [L('a'), L('b')]
    const out = applyFeedOrder(items, ['zzz', 'b', 'qqq'])
    expect(out.map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('handles duplicate feed ids (first occurrence wins, no dupes emitted)', () => {
    const items = [L('a'), L('b'), L('c')]
    const out = applyFeedOrder(items, ['b', 'b', 'a'])
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(out).toHaveLength(3)
  })

  it('fully reorders when every item is in the feed', () => {
    const items = [L('a'), L('b'), L('c')]
    const out = applyFeedOrder(items, ['c', 'b', 'a'])
    expect(out.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('preserves every original item exactly once', () => {
    const items = [L('a'), L('b'), L('c'), L('d')]
    const out = applyFeedOrder(items, ['d'])
    expect(new Set(out.map((x) => x.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(out).toHaveLength(4)
  })
})
