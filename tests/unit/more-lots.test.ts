import { describe, expect, it } from 'vitest'
import { pickMoreLots } from '@/app/browse/more-lots'
import { PROTO_LISTINGS } from '@/app/proto/fixtures'

describe('pickMoreLots', () => {
  it('prefers unseen lots, then fills from the far end of the excluded set', () => {
    const shown = PROTO_LISTINGS.filter((l) => !l.sold)
    const sold = PROTO_LISTINGS.find((l) => l.sold)
    expect(sold).toBeTruthy()
    const more = pickMoreLots(PROTO_LISTINGS, { excludeIds: shown.map((l) => l.id), limit: 4 })
    expect(more[0]?.id).toBe(sold!.id)
    expect(more).toHaveLength(4)
    expect(more.filter((l) => l.id === shown[0].id)).toHaveLength(0)
  })

  it('puts the same category first when a category is given', () => {
    const current = PROTO_LISTINGS[0]
    const more = pickMoreLots(PROTO_LISTINGS, { excludeIds: [current.id], category: current.category })
    expect(more.every((l) => l.id !== current.id)).toBe(true)
    const same = more.filter((l) => l.category === current.category)
    const other = more.filter((l) => l.category !== current.category)
    expect(more.slice(0, same.length).every((l) => l.category === current.category)).toBe(true)
    expect(other.length).toBeGreaterThan(0)
  })
})
