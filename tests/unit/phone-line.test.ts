import { describe, it, expect } from 'vitest'
import { normalizeE164, isBlockedLineType } from '../../lib/phone/line'

describe('normalizeE164', () => {
  it('passes through valid E.164', () => {
    expect(normalizeE164('+14155551234')).toBe('+14155551234')
    expect(normalizeE164('+442079460958')).toBe('+442079460958')
  })
  it('adds +1 for a US 10-digit number', () => {
    expect(normalizeE164('4155551234')).toBe('+14155551234')
    expect(normalizeE164('(415) 555-1234')).toBe('+14155551234')
    expect(normalizeE164('415-555-1234')).toBe('+14155551234')
  })
  it('handles 11-digit US with leading 1', () => {
    expect(normalizeE164('14155551234')).toBe('+14155551234')
    expect(normalizeE164('1 (415) 555-1234')).toBe('+14155551234')
  })
  it('rejects junk / wrong length', () => {
    expect(normalizeE164('abc')).toBeNull()
    expect(normalizeE164('12345')).toBeNull()
    expect(normalizeE164('')).toBeNull()
    expect(normalizeE164('+1')).toBeNull()
  })
})

describe('isBlockedLineType', () => {
  it('blocks VOIP / burner families', () => {
    for (const t of ['voip', 'nonFixedVoip', 'fixedVoip', 'voicemail']) expect(isBlockedLineType(t)).toBe(true)
  })
  it('allows mobile + landline + unknown/null', () => {
    expect(isBlockedLineType('mobile')).toBe(false)
    expect(isBlockedLineType('landline')).toBe(false)
    expect(isBlockedLineType(null)).toBe(false)
    expect(isBlockedLineType(undefined)).toBe(false)
  })
})
