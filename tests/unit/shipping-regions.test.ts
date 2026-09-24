import { describe, it, expect } from 'vitest'
import {
  regionsForOrigin,
  regionForDestination,
  cleanIntlShipping,
  quoteShipping,
  intlSummary,
  needsIntlRegion,
  MAX_REGION_RATE_CENTS,
} from '../../lib/shipping-regions'
import { cleanAddress, isShippable, addressLines } from '../../lib/addresses'
import { COUNTRY_OPTIONS, normalizeCountry, isRestrictedCountry } from '../../lib/countries'
import { formatCents } from '../../lib/fees'

describe('regionsForOrigin', () => {
  it('US sellers price Canada (the US lane is automatic)', () => {
    expect(regionsForOrigin('US')).toEqual(['canada', 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other'])
    expect(regionsForOrigin(null)).toEqual(regionsForOrigin('US'))
  })
  it('sellers anywhere else price North America instead of Canada', () => {
    expect(regionsForOrigin('GB')[0]).toBe('north_america')
    expect(regionsForOrigin('JP')).not.toContain('canada')
  })
})

describe('regionForDestination', () => {
  it('US → US is the domestic (prepaid label) lane; blank country means US', () => {
    expect(regionForDestination('US', 'US')).toBe('domestic')
    expect(regionForDestination('US', '')).toBe('domestic')
    expect(regionForDestination('US', null)).toBe('domestic')
  })
  it('maps a US seller\'s buyers by region', () => {
    expect(regionForDestination('US', 'CA')).toBe('canada')
    expect(regionForDestination('US', 'MX')).toBe('other')
    expect(regionForDestination('US', 'GB')).toBe('united_kingdom')
    expect(regionForDestination('US', 'FR')).toBe('europe')
    expect(regionForDestination('US', 'JP')).toBe('asia')
    expect(regionForDestination('US', 'NZ')).toBe('australia_nz')
    expect(regionForDestination('US', 'BR')).toBe('other')
  })
  it('a non-US seller ships US, Canada and Mexico on the North America rate', () => {
    for (const dest of ['US', 'CA', 'MX']) expect(regionForDestination('GB', dest)).toBe('north_america')
    expect(regionForDestination('CA', 'CA')).toBe('north_america')
    expect(regionForDestination('GB', 'GB')).toBe('united_kingdom')
  })
  it('restricted and unknown destinations are refused', () => {
    expect(regionForDestination('US', 'RU')).toBeNull()
    expect(regionForDestination('US', 'KP')).toBeNull()
    expect(regionForDestination('US', 'ZZ')).toBeNull()
  })
})

describe('cleanIntlShipping', () => {
  it('keeps valid integer cents for the origin\'s regions, in order', () => {
    expect(cleanIntlShipping({ europe: 5000, canada: 2000 }, 'US')).toEqual({ canada: 2000, europe: 5000 })
  })
  it('drops bad amounts, unknown keys and keys that don\'t apply to the origin', () => {
    const out = cleanIntlShipping({ canada: -1, europe: 12.5, asia: MAX_REGION_RATE_CENTS + 1, mars: 100, other: '3000', australia_nz: 0 }, 'US')
    expect(out).toEqual({ other: 3000, australia_nz: 0 })
    expect(cleanIntlShipping({ north_america: 2000, canada: 1500 }, 'US')).toEqual({ canada: 1500 })
  })
  it('string amounts must be whole digits (a blank never becomes FREE)', () => {
    expect(cleanIntlShipping({ canada: ' ', europe: '1e3', asia: '12.5', other: ' 800 ' }, 'US')).toEqual({ other: 800 })
  })
  it('re-keys Canada ↔ North America when the seller moves', () => {
    expect(cleanIntlShipping({ canada: 2000 }, 'GB')).toEqual({ north_america: 2000 })
    expect(cleanIntlShipping({ north_america: 2000 }, 'US')).toEqual({ canada: 2000 })
  })
  it('garbage in → empty', () => {
    for (const raw of [null, undefined, 'x', 5, [1, 2]]) expect(cleanIntlShipping(raw, 'US')).toEqual({})
  })
})

describe('quoteShipping', () => {
  const intl = { canada: 2000, europe: 5000 }
  it('US → US uses the system-derived price and the platform label', () => {
    expect(quoteShipping({ origin: 'US', destination: 'US', domesticCents: 1700, intl })).toEqual({ ok: true, labelMode: 'platform', region: 'domestic', cents: 1700 })
  })
  it('offers keep no domestic shipping line but still pay international', () => {
    expect(quoteShipping({ origin: 'US', destination: 'US', domesticCents: 1700, intl, isOffer: true })).toMatchObject({ ok: true, cents: 0 })
    expect(quoteShipping({ origin: 'US', destination: 'DE', domesticCents: 1700, intl, isOffer: true })).toMatchObject({ ok: true, labelMode: 'seller', cents: 5000 })
  })
  it('international lanes use the seller rate and the seller label', () => {
    expect(quoteShipping({ origin: 'US', destination: 'CA', domesticCents: 1700, intl })).toEqual({ ok: true, labelMode: 'seller', region: 'canada', cents: 2000 })
  })
  it('a region the seller doesn\'t offer is not_offered; restricted is restricted', () => {
    expect(quoteShipping({ origin: 'US', destination: 'JP', domesticCents: 1700, intl })).toEqual({ ok: false, reason: 'not_offered', region: 'asia' })
    expect(quoteShipping({ origin: 'US', destination: 'IR', domesticCents: 1700, intl })).toEqual({ ok: false, reason: 'restricted', region: null })
  })
  it('a non-US seller has no automatic lane: US buyers pay the North America rate', () => {
    expect(quoteShipping({ origin: 'GB', destination: 'US', domesticCents: 1700, intl: { north_america: 3500 } })).toEqual({ ok: true, labelMode: 'seller', region: 'north_america', cents: 3500 })
    expect(quoteShipping({ origin: 'GB', destination: 'US', domesticCents: 1700, intl: {} })).toMatchObject({ ok: false, reason: 'not_offered' })
  })
})

describe('intlSummary + needsIntlRegion', () => {
  it('summarises the dropdown', () => {
    expect(intlSummary({ canada: 2000, united_kingdom: 4000 }, formatCents, 'US')).toBe('2 regions · from $20')
    expect(intlSummary({}, formatCents, 'US')).toBe('US only')
    expect(intlSummary({}, formatCents, 'GB')).toBe('No regions yet')
    expect(intlSummary({ other: 0 }, formatCents, 'US')).toBe('1 region · from free')
  })
  it('only non-US sellers must offer a region', () => {
    expect(needsIntlRegion('US', {})).toBe(false)
    expect(needsIntlRegion('GB', {})).toBe(true)
    expect(needsIntlRegion('GB', { europe: 1000 })).toBe(false)
  })
})

describe('countries', () => {
  it('lists the US first and never offers a restricted country', () => {
    expect(COUNTRY_OPTIONS[0].code).toBe('US')
    expect(normalizeCountry('gb')).toBe('GB')
    expect(normalizeCountry('ZZ')).toBeNull()
    expect(isRestrictedCountry('RU')).toBe(true)
  })
})

describe('cleanAddress (international)', () => {
  const base = { name: 'A B', street1: '1 Main St', city: 'Town' }
  it('defaults to the US and keeps the strict US rules', () => {
    const r = cleanAddress({ ...base, state: 'ny', zip: '10001' })
    expect('address' in r && r.address.country).toBe('US')
    expect(cleanAddress({ ...base, state: 'NY', zip: '1001' })).toEqual({ error: 'ZIP must be 5 digits (or ZIP+4).' })
  })
  it('validates Canada, the UK and Australia with their own rules', () => {
    expect('address' in cleanAddress({ ...base, country: 'CA', state: 'ON', zip: 'k1a 0b1' })).toBe(true)
    expect('error' in cleanAddress({ ...base, country: 'CA', state: 'ON', zip: '12345' })).toBe(true)
    expect('address' in cleanAddress({ ...base, country: 'GB', zip: 'SW1A 1AA' })).toBe(true)
    expect('address' in cleanAddress({ ...base, country: 'AU', state: 'NSW', zip: '2000' })).toBe(true)
  })
  it('elsewhere region and postal code are optional', () => {
    const r = cleanAddress({ ...base, country: 'HK' })
    expect('address' in r && r.address).toMatchObject({ country: 'HK', state: '', zip: '' })
    expect(isShippable({ ...base, country: 'HK' })).toBe(true)
  })
  it('refuses restricted and unknown countries', () => {
    expect('error' in cleanAddress({ ...base, country: 'RU', zip: '101000' })).toBe(true)
    expect('error' in cleanAddress({ ...base, country: 'ZZ' })).toBe(true)
  })
  it('address cards name the country', () => {
    expect(addressLines({ street1: '1 Main St', street2: null, city: 'London', state: '', zip: 'SW1A 1AA', country: 'GB' })).toEqual(['1 Main St', 'London, SW1A 1AA', 'United Kingdom'])
    expect(addressLines({ street1: '1 Main St', street2: null, city: 'NYC', state: 'NY', zip: '10001' })[2]).toBe('United States')
  })
})
