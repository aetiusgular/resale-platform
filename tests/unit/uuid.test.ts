import { describe, it, expect } from 'vitest'
import { isUuid } from '../../lib/security/uuid'

describe('isUuid', () => {
  it('accepts canonical v4 UUIDs (Supabase-generated)', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
  })
  it('is case-insensitive', () => {
    expect(isUuid('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true)
  })
  it('rejects malformed / injection-ish strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid("123'; DROP TABLE listings;--")).toBe(false)
    expect(isUuid('123e4567e89b42d3a456426614174000')).toBe(false) // no dashes
    expect(isUuid('123e4567-e89b-42d3-a456-42661417400')).toBe(false) // too short
    expect(isUuid('123e4567-e89b-62d3-a456-426614174000')).toBe(false) // bad version (6)
  })
  it('rejects non-strings', () => {
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(123)).toBe(false)
    expect(isUuid('')).toBe(false)
  })
})
