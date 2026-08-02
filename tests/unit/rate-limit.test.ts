import { describe, it, expect } from 'vitest'
import { rateLimitDecision } from '@/lib/rate-limit'

const NOW = 1_700_000_000_000
const WINDOW = 60_000
const START = Math.floor(NOW / WINDOW) * WINDOW

describe('rateLimitDecision', () => {
  it('allows below the limit and reports remaining', () => {
    const r = rateLimitDecision(1, 5, START, WINDOW, NOW)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('allows at exactly the limit (remaining 0)', () => {
    const r = rateLimitDecision(5, 5, START, WINDOW, NOW)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(0)
  })

  it('blocks the request that exceeds the limit', () => {
    const r = rateLimitDecision(6, 5, START, WINDOW, NOW)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('returns a positive, bounded retryAfterSeconds', () => {
    const r = rateLimitDecision(2, 1, START, WINDOW, NOW)
    expect(r.retryAfterSeconds).toBeGreaterThan(0)
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('retryAfter never goes negative past the window', () => {
    const r = rateLimitDecision(2, 1, START, WINDOW, START + WINDOW + 5000)
    expect(r.retryAfterSeconds).toBe(0)
  })
})
