import { describe, it, expect } from 'vitest'
import {
  centsToPrice,
  photoPaths,
  toListingChange,
  listingSold,
  listingDeleted,
  MAX_RECS_PHOTOS,
  type ListingRowForRecs,
} from '../../lib/recs/listing-map'

const ROW: ListingRowForRecs = {
  id: '00000000-0000-4000-8000-0000000000c0',
  brand: 'Carhartt',
  category: 'outerwear',
  price_cents: 12000,
  size: 'L',
  condition_score: 8,
  created_at: '2026-07-23T12:00:00+00:00',
  images: ['https://cdn/a.jpg', '', 'https://cdn/c.jpg', '', '', ''],
}

describe('centsToPrice', () => {
  it('integer cents → positive dollars', () => {
    expect(centsToPrice(12000)).toBe(120)
    expect(centsToPrice(999)).toBe(9.99)
    expect(centsToPrice(1)).toBe(0.01)
  })
})

describe('photoPaths', () => {
  it('keeps non-empty slots in order', () => {
    expect(photoPaths(ROW.images)).toEqual(['https://cdn/a.jpg', 'https://cdn/c.jpg'])
  })
  it('caps at the recs photo limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://cdn/${i}.jpg`)
    expect(photoPaths(many)).toHaveLength(MAX_RECS_PHOTOS)
  })
  it('empty when no slots filled', () => {
    expect(photoPaths(['', '', ''])).toEqual([])
  })
})

describe('toListingChange', () => {
  it('builds a created change with lean payload + primary_index 0', () => {
    const change = toListingChange(ROW, 'created')
    expect(change).toEqual({
      kind: 'created',
      listing_id: ROW.id,
      payload: {
        brand: 'Carhartt',
        category: 'outerwear',
        price: 120,
        listed_at: '2026-07-23T12:00:00+00:00',
        size: 'L',
        condition: '8/10',
      },
      photo_paths: ['https://cdn/a.jpg', 'https://cdn/c.jpg'],
      primary_index: 0,
    })
  })

  it('omits optional fields that are absent', () => {
    const bare: ListingRowForRecs = {
      id: ROW.id,
      brand: 'Nike',
      category: 'footwear',
      price_cents: 5000,
      created_at: ROW.created_at,
      images: ['https://cdn/x.jpg'],
    }
    const change = toListingChange(bare, 'updated')
    expect(change?.payload).toEqual({
      brand: 'Nike',
      category: 'footwear',
      price: 50,
      listed_at: ROW.created_at,
    })
    expect(change?.kind).toBe('updated')
  })

  it('attaches aesthetic_tags and seller_rating only when present', () => {
    const enriched = { ...ROW, aesthetic_tags: ['workwear'], seller_rating: 4.5 }
    const change = toListingChange(enriched, 'created')
    expect(change?.payload.aesthetic_tags).toEqual(['workwear'])
    expect(change?.payload.seller_rating).toBe(4.5)
  })

  it('returns null when the listing has no usable photos (caller skips sync)', () => {
    expect(toListingChange({ ...ROW, images: ['', '', ''] }, 'created')).toBeNull()
  })
})

describe('sold / deleted', () => {
  it('carry only the kind + listing_id', () => {
    expect(listingSold(ROW.id)).toEqual({ kind: 'sold', listing_id: ROW.id })
    expect(listingDeleted(ROW.id)).toEqual({ kind: 'deleted', listing_id: ROW.id })
  })
})
