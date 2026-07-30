import { describe, it, expect } from 'vitest'
import { matchesSavedSearch, type MatchableListing, type SavedSearchQuery } from '../../lib/search/match'

const LISTING: MatchableListing = {
  status: 'active',
  title: 'Vintage Carhartt Detroit jacket',
  brand: 'Carhartt',
  category: 'outerwear',
  department: 'mens',
  size: 'L',
  condition_score: 8,
  price_cents: 12000, // $120
  is_price_dropped: false,
  seller_verified: false,
}

const match = (q: SavedSearchQuery, l: Partial<MatchableListing> = {}) =>
  matchesSavedSearch({ ...LISTING, ...l }, q)

describe('matchesSavedSearch', () => {
  it('empty query matches any active listing', () => {
    expect(match({})).toBe(true)
  })

  it('never matches a non-active listing', () => {
    for (const status of ['draft', 'pending_review', 'sold', 'removed']) {
      expect(match({}, { status })).toBe(false)
    }
  })

  it('exact filters: dept / cat / size', () => {
    expect(match({ dept: 'mens' })).toBe(true)
    expect(match({ dept: 'womens' })).toBe(false)
    expect(match({ cat: 'outerwear' })).toBe(true)
    expect(match({ cat: 'footwear' })).toBe(false)
    expect(match({ size: 'L' })).toBe(true)
    expect(match({ size: 'M' })).toBe(false)
  })

  it('brand is case-insensitive substring (mirrors ilike %brand%)', () => {
    expect(match({ brand: 'carh' })).toBe(true)
    expect(match({ brand: 'CARHARTT' })).toBe(true)
    expect(match({ brand: 'nike' })).toBe(false)
  })

  it('price range is inclusive, dollars → cents', () => {
    expect(match({ min_price: '100', max_price: '150' })).toBe(true) // 120 in [100,150]
    expect(match({ min_price: '120' })).toBe(true) // inclusive lower
    expect(match({ max_price: '120' })).toBe(true) // inclusive upper
    expect(match({ min_price: '150' })).toBe(false)
    expect(match({ max_price: '100' })).toBe(false)
  })

  it('cond is a minimum condition score', () => {
    expect(match({ cond: '8' })).toBe(true) // 8 >= 8
    expect(match({ cond: '9' })).toBe(false)
    expect(match({ cond: '5' })).toBe(true)
  })

  it('dropped requires is_price_dropped', () => {
    expect(match({ dropped: '1' })).toBe(false)
    expect(match({ dropped: '1' }, { is_price_dropped: true })).toBe(true)
    expect(match({ dropped: '0' })).toBe(true) // only '1' constrains
  })

  it('verified requires a verified seller', () => {
    expect(match({ verified: '1' })).toBe(false)
    expect(match({ verified: '1' }, { seller_verified: true })).toBe(true)
  })

  it('q matches when every token is a substring of title/brand/category/department', () => {
    expect(match({ q: 'carhartt jacket' })).toBe(true)
    expect(match({ q: 'detroit' })).toBe(true)
    expect(match({ q: 'carhartt hoodie' })).toBe(false) // "hoodie" absent
  })

  it('combines filters with AND — all must pass', () => {
    expect(match({ dept: 'mens', brand: 'carhartt', max_price: '150', cond: '7' })).toBe(true)
    expect(match({ dept: 'mens', brand: 'carhartt', max_price: '100' })).toBe(false) // price fails
  })

  it('ignores unparseable numeric bounds rather than over-filtering', () => {
    expect(match({ min_price: 'abc' })).toBe(true)
    expect(match({ cond: 'x' })).toBe(true)
  })

  it('ignores the sort key (not a filter)', () => {
    expect(match({ sort: 'price_asc' })).toBe(true)
  })
})
