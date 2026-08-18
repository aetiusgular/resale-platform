import { describe, it, expect } from 'vitest'
import {
  parseCheapestGroundCents,
  easypostConfigured,
  makeEasypostRater,
  WORST_ZONE_DEST_ZIP,
} from '../../lib/shipping-easypost'

describe('parseCheapestGroundCents', () => {
  it('returns null for empty / missing input', () => {
    expect(parseCheapestGroundCents(null)).toBeNull()
    expect(parseCheapestGroundCents(undefined)).toBeNull()
    expect(parseCheapestGroundCents([])).toBeNull()
  })
  it('picks the cheapest ENABLED ground service, in cents', () => {
    const rates = [
      { service: 'GroundAdvantage', rate: '8.42' },
      { service: 'UPSGround', rate: '7.15' },
      { service: 'Priority', rate: '5.10' }, // not a ground service → ignored
    ]
    expect(parseCheapestGroundCents(rates)).toBe(715)
  })
  it('ignores non-ground services even when cheaper', () => {
    const rates = [
      { service: 'Express', rate: '3.00' },
      { service: 'GroundAdvantage', rate: '9.99' },
    ]
    expect(parseCheapestGroundCents(rates)).toBe(999)
  })
  it('returns null when no ground service is present', () => {
    expect(parseCheapestGroundCents([{ service: 'Express', rate: '3.00' }])).toBeNull()
  })
  it('skips unparseable / non-positive rates', () => {
    const rates = [
      { service: 'Ground', rate: 'oops' },
      { service: 'UPSGround', rate: '0' },
      { service: 'GroundAdvantage', rate: '12.00' },
    ]
    expect(parseCheapestGroundCents(rates)).toBe(1200)
  })
})

describe('easypostConfigured / makeEasypostRater (flag off in test env)', () => {
  it('is not configured when SHIPPING_LABELS_ENABLED is off', () => {
    expect(easypostConfigured()).toBe(false)
  })
  it('rater returns null (→ floor price) when disabled or no from-zip', async () => {
    const preset = { weightOz: 16, lengthIn: 12, widthIn: 9, heightIn: 3, floorCents: 700 }
    expect(await makeEasypostRater('98101')(preset, 'Tops')).toBeNull() // flag off
    expect(await makeEasypostRater(null)(preset, 'Tops')).toBeNull()
    expect(await makeEasypostRater(undefined)(preset, 'Tops')).toBeNull()
  })
  it('exposes a 5-digit worst-zone destination ZIP', () => {
    expect(WORST_ZONE_DEST_ZIP).toMatch(/^\d{5}$/)
  })
})
