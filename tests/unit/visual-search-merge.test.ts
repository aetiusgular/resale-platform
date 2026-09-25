import { describe, expect, it } from 'vitest'
import {
  mergeVisualResults,
  photoIndexFromSlot,
  type EngineVisualResponse,
  type HashHit,
} from '@/lib/visual-search/merge'
import { isBlockhashHex, sniffImageType } from '@/lib/visual-search/image'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'
const D = '00000000-0000-4000-8000-00000000000d'

function engine(results: EngineVisualResponse['results'], category: string | null = 'outerwear'): EngineVisualResponse {
  const counts = { exact: 0, match: 0, close: 0 }
  for (const r of results) counts[r.tier] += 1
  return {
    listed: counts.exact + counts.match > 0,
    query_category: category,
    results,
    counts,
    thresholds: { exact_cos: 0.93, match_cos: 0.8 },
    space_version: 'frozen_v1',
  }
}

describe('photoIndexFromSlot', () => {
  it('maps PHOTO_n and legacy slots', () => {
    expect(photoIndexFromSlot('PHOTO_1')).toBe(0)
    expect(photoIndexFromSlot('PHOTO_15')).toBe(14)
    expect(photoIndexFromSlot('FRONT')).toBe(0)
    expect(photoIndexFromSlot('FLAW')).toBe(4)
    expect(photoIndexFromSlot('POSSESSION')).toBeNull()
    expect(photoIndexFromSlot('nope')).toBeNull()
  })
})

describe('mergeVisualResults', () => {
  it('hash tier alone: exact at/under the Hamming cap, close above, possession ignored', () => {
    const hashHits: HashHit[] = [
      { listing_id: A, slot: 'PHOTO_2', distance: 3 },
      { listing_id: A, slot: 'PHOTO_1', distance: 0 }, // nearer slot wins
      { listing_id: B, slot: 'PHOTO_1', distance: 20 },
      { listing_id: C, slot: 'POSSESSION', distance: 0 },
    ]
    const out = mergeVisualResults({ hashHits, engine: null, exactHamming: 12 })
    expect(out.engine).toBe('unavailable')
    expect(out.listed).toBe(true)
    expect(out.category).toBeNull()
    expect(out.exact.map((h) => [h.listing_id, h.hamming, h.photo_index, h.source])).toEqual([[A, 0, 0, 'hash']])
    expect(out.match).toEqual([])
    expect(out.close.map((h) => h.listing_id)).toEqual([B])
    expect(out.exact.concat(out.close).some((h) => h.listing_id === C)).toBe(false)
  })

  it('engine tiers alone pass through in order', () => {
    const out = mergeVisualResults({
      hashHits: [],
      engine: engine([
        { listing_id: A, photo_index: 2, score: 0.97, tier: 'exact' },
        { listing_id: B, photo_index: 0, score: 0.85, tier: 'match' },
        { listing_id: C, photo_index: 1, score: 0.6, tier: 'close' },
      ]),
      exactHamming: 12,
    })
    expect(out.engine).toBe('ok')
    expect(out.category).toBe('outerwear')
    expect(out.exact.map((h) => h.listing_id)).toEqual([A])
    expect(out.match.map((h) => h.listing_id)).toEqual([B])
    expect(out.close.map((h) => h.listing_id)).toEqual([C])
    expect(out.exact[0]).toMatchObject({ score: 0.97, hamming: null, photo_index: 2, source: 'engine' })
  })

  it('a listing appears once, in its best tier, with both signals kept', () => {
    const out = mergeVisualResults({
      hashHits: [
        { listing_id: A, slot: 'PHOTO_3', distance: 2 }, // hash says exact
        { listing_id: B, slot: 'PHOTO_1', distance: 40 }, // hash says close
      ],
      engine: engine([
        { listing_id: A, photo_index: 0, score: 0.7, tier: 'close' }, // engine disagrees → exact wins
        { listing_id: B, photo_index: 4, score: 0.9, tier: 'match' }, // engine upgrades B to match
        { listing_id: D, photo_index: 0, score: 0.5, tier: 'close' },
      ]),
      exactHamming: 12,
    })
    const ids = [...out.exact, ...out.match, ...out.close].map((h) => h.listing_id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(out.exact[0]).toMatchObject({ listing_id: A, tier: 'exact', hamming: 2, score: 0.7, photo_index: 2, source: 'both' })
    expect(out.match[0]).toMatchObject({ listing_id: B, hamming: 40, score: 0.9, photo_index: 4, source: 'both' })
    expect(out.close.map((h) => h.listing_id)).toEqual([D])
    expect(out.listed).toBe(true)
  })

  it('not listed when nothing clears match; close tier still carries the results', () => {
    const out = mergeVisualResults({
      hashHits: [{ listing_id: A, slot: 'PHOTO_1', distance: 60 }],
      engine: engine([
        { listing_id: B, photo_index: 0, score: 0.7, tier: 'close' },
        { listing_id: C, photo_index: 0, score: 0.65, tier: 'close' },
      ], null),
      exactHamming: 12,
    })
    expect(out.listed).toBe(false)
    expect(out.exact).toEqual([])
    expect(out.match).toEqual([])
    // engine-scored hits first (score desc), hash-only close hit last
    expect(out.close.map((h) => h.listing_id)).toEqual([B, C, A])
  })

  it('exact tier orders by Hamming distance first, then score', () => {
    const out = mergeVisualResults({
      hashHits: [
        { listing_id: A, slot: 'PHOTO_1', distance: 8 },
        { listing_id: B, slot: 'PHOTO_1', distance: 1 },
      ],
      engine: engine([{ listing_id: C, photo_index: 0, score: 0.99, tier: 'exact' }]),
      exactHamming: 12,
    })
    expect(out.exact.map((h) => h.listing_id)).toEqual([B, A, C])
  })
})

describe('image helpers', () => {
  it('sniffs jpeg / png / webp and rejects the rest', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    const webp = new Uint8Array(12)
    webp.set([0x52, 0x49, 0x46, 0x46], 0)
    webp.set([0x57, 0x45, 0x42, 0x50], 8)
    expect(sniffImageType(webp)).toBe('image/webp')
    expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull() // gif
    expect(sniffImageType(new Uint8Array([]))).toBeNull()
  })

  it('validates the 64-hex blockhash form', () => {
    expect(isBlockhashHex('a'.repeat(64))).toBe(true)
    expect(isBlockhashHex('A'.repeat(64))).toBe(false)
    expect(isBlockhashHex('a'.repeat(63))).toBe(false)
  })
})

describe('category_source and text passthrough', () => {
  it('carries the engine\'s category source and applied text, null without an engine', () => {
    const out = mergeVisualResults({
      hashHits: [], exactHamming: 12,
      engine: { listed: false, query_category: 'Tops', category_source: 'guess', query_text: 'striped', results: [], counts: { exact: 0, match: 0, close: 0 }, thresholds: { exact_cos: 0.93, match_cos: 0.8 } },
    })
    expect(out.category).toBe('Tops')
    expect(out.category_source).toBe('guess')
    expect(out.text).toBe('striped')
    const down = mergeVisualResults({ hashHits: [], engine: null, exactHamming: 12 })
    expect(down).toMatchObject({ category: null, category_source: null, text: null, engine: 'unavailable' })
  })
})
