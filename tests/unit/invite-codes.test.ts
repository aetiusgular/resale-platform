import { describe, it, expect } from 'vitest'
import { generateCode, normalizeCode, isValidCodeFormat } from '../../lib/invite-codes'

const ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))

describe('generateCode', () => {
  it('produces XXXX-XXXX format', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    }
  })

  it('uses only unambiguous characters (no 0, O, 1, I)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      const chars = code.replace('-', '').split('')
      for (const ch of chars) {
        expect(ALPHABET.has(ch)).toBe(true)
      }
    }
  })

  it('generates different codes across runs', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()))
    // Extremely unlikely to have collisions across 50 codes
    expect(codes.size).toBeGreaterThan(40)
  })
})

describe('normalizeCode', () => {
  it('uppercases input', () => {
    expect(normalizeCode('abcd-efgh')).toBe('ABCD-EFGH')
  })

  it('trims whitespace', () => {
    expect(normalizeCode('  ABCD-EFGH  ')).toBe('ABCD-EFGH')
  })

  it('replaces underscores with hyphens', () => {
    expect(normalizeCode('ABCD_EFGH')).toBe('ABCD-EFGH')
  })
})

describe('isValidCodeFormat', () => {
  it('accepts valid XXXX-XXXX codes', () => {
    expect(isValidCodeFormat('ABCD-EFGH')).toBe(true)
    expect(isValidCodeFormat('2345-6789')).toBe(true)
    expect(isValidCodeFormat('ABCD-2345')).toBe(true)
  })

  it('rejects codes with ambiguous chars', () => {
    expect(isValidCodeFormat('ABCD-EFG0')).toBe(false) // 0 not allowed
    expect(isValidCodeFormat('ABCD-EFGO')).toBe(false) // O not allowed
    expect(isValidCodeFormat('ABCD-EFG1')).toBe(false) // 1 not allowed
    expect(isValidCodeFormat('ABCD-EFGI')).toBe(false) // I not allowed
  })

  it('rejects wrong-length codes', () => {
    expect(isValidCodeFormat('ABC-DEFG')).toBe(false)
    expect(isValidCodeFormat('ABCDE-FGHIJ')).toBe(false)
    expect(isValidCodeFormat('ABCDEFGH')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidCodeFormat('')).toBe(false)
  })

  it('normalizes before checking', () => {
    expect(isValidCodeFormat('abcd-efgh')).toBe(true)
    expect(isValidCodeFormat('  ABCD-EFGH  ')).toBe(true)
  })
})
