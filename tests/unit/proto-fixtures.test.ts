import { describe, expect, it } from 'vitest'
import { getProtoListing, PROTO_LISTINGS } from '@/app/proto/fixtures'

describe('proto fixtures', () => {
  it('ships 8–12 listings with integer-cent prices', () => {
    expect(PROTO_LISTINGS.length).toBeGreaterThanOrEqual(8)
    expect(PROTO_LISTINGS.length).toBeLessThanOrEqual(12)
    for (const l of PROTO_LISTINGS) {
      expect(Number.isInteger(l.price_cents)).toBe(true)
      expect(l.price_cents).toBeGreaterThan(0)
      expect(l.price_display.startsWith('$')).toBe(true)
      expect(l.id.startsWith('proto-')).toBe(true)
    }
  })

  it('looks up a fixture by id', () => {
    const first = PROTO_LISTINGS[0]
    expect(getProtoListing(first.id)?.title).toBe(first.title)
    expect(getProtoListing('missing')).toBeUndefined()
  })
})
