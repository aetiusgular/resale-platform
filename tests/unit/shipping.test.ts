import { describe, it, expect } from 'vitest'
import {
  SHIPPING_CATEGORIES,
  SHIPPING_MARGIN_CENTS,
  SHIPPING_PRESETS,
  presetFor,
  resolveShippingCents,
  floorShippingCents,
  quoteShippingCents,
  type ParcelPreset,
} from '../../lib/shipping'

describe('SHIPPING_PRESETS', () => {
  it('has a preset for every category, all fields positive integers', () => {
    for (const cat of SHIPPING_CATEGORIES) {
      const p = SHIPPING_PRESETS[cat]
      expect(p).toBeDefined()
      for (const v of [p.weightOz, p.lengthIn, p.widthIn, p.heightIn, p.floorCents]) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThan(0)
      }
    }
  })
  it('honors the user-set minimum floors', () => {
    expect(SHIPPING_PRESETS.Tops.floorCents).toBe(700)       // >= $7
    expect(SHIPPING_PRESETS.Outerwear.floorCents).toBe(1500) // >= $15
    expect(SHIPPING_PRESETS.Footwear.floorCents).toBe(2000)  // >= $20
  })
})

describe('presetFor', () => {
  it('returns the exact preset for a known category', () => {
    expect(presetFor('Footwear')).toBe(SHIPPING_PRESETS.Footwear)
  })
  it('falls back to Other for unknown / empty category', () => {
    expect(presetFor('Sneakers')).toBe(SHIPPING_PRESETS.Other)
    expect(presetFor('')).toBe(SHIPPING_PRESETS.Other)
  })
})

describe('resolveShippingCents', () => {
  it('no quote → floor + margin, source preset', () => {
    const r = resolveShippingCents('Tops', null)
    expect(r).toEqual({ cents: 700 + SHIPPING_MARGIN_CENTS, source: 'preset' })
  })
  it('quote below floor → clamped to floor + margin, source quote', () => {
    const r = resolveShippingCents('Footwear', 500) // $5 quote < $20 floor
    expect(r).toEqual({ cents: 2000 + SHIPPING_MARGIN_CENTS, source: 'quote' })
  })
  it('quote above floor → quote + margin, source quote', () => {
    const r = resolveShippingCents('Tops', 1300) // $13 quote > $7 floor
    expect(r).toEqual({ cents: 1300 + SHIPPING_MARGIN_CENTS, source: 'quote' })
  })
  it('never drops below floor + margin regardless of input', () => {
    for (const cat of SHIPPING_CATEGORIES) {
      const floorPlus = SHIPPING_PRESETS[cat].floorCents + SHIPPING_MARGIN_CENTS
      for (const q of [null, undefined, 0, -50, NaN, Infinity, 1, 99999]) {
        expect(resolveShippingCents(cat, q as number).cents).toBeGreaterThanOrEqual(floorPlus)
      }
    }
  })
  it('always includes the margin over the effective base', () => {
    expect(resolveShippingCents('Denim', 5000).cents - 5000).toBe(SHIPPING_MARGIN_CENTS)
  })
})

describe('floorShippingCents', () => {
  it('equals floor + margin', () => {
    expect(floorShippingCents('Outerwear')).toBe(1500 + SHIPPING_MARGIN_CENTS)
  })
})

describe('quoteShippingCents (injected rater)', () => {
  const okRater = async (p: ParcelPreset) => 1800 + p.weightOz // deterministic, uses preset
  const nullRater = async () => null
  const throwRater = async () => { throw new Error('easypost down') }

  it('uses a live quote when the rater returns one', async () => {
    const r = await quoteShippingCents('Tops', okRater)
    expect(r.source).toBe('quote')
    expect(r.cents).toBe(Math.max(1800 + 16, 700) + SHIPPING_MARGIN_CENTS)
  })
  it('fails soft to floor when rater returns null', async () => {
    const r = await quoteShippingCents('Tops', nullRater)
    expect(r).toEqual({ cents: 700 + SHIPPING_MARGIN_CENTS, source: 'preset' })
  })
  it('never throws — a rater error becomes a preset price', async () => {
    const r = await quoteShippingCents('Footwear', throwRater)
    expect(r).toEqual({ cents: 2000 + SHIPPING_MARGIN_CENTS, source: 'preset' })
  })
})
