import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

// Reset internal state by using unique keys per test
let testId = 0
function key(suffix = '') {
  return `test:${Date.now()}:${testId++}:${suffix}`
}

describe('checkRateLimit', () => {
  it('allows requests below the limit', () => {
    const k = key()
    const r = checkRateLimit(k, 5, 60_000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('blocks on the request that exceeds the limit', () => {
    const k = key()
    for (let i = 0; i < 5; i++) checkRateLimit(k, 5, 60_000)
    const r6 = checkRateLimit(k, 5, 60_000)
    expect(r6.allowed).toBe(false)
    expect(r6.remaining).toBe(0)
  })

  it('allows at exactly the limit', () => {
    const k = key()
    let last = checkRateLimit(k, 3, 60_000)
    last = checkRateLimit(k, 3, 60_000)
    last = checkRateLimit(k, 3, 60_000)
    expect(last.allowed).toBe(true)
    expect(last.remaining).toBe(0)
    const over = checkRateLimit(k, 3, 60_000)
    expect(over.allowed).toBe(false)
  })

  it('isolates different keys', () => {
    const k1 = key('a')
    const k2 = key('b')
    for (let i = 0; i < 10; i++) checkRateLimit(k1, 2, 60_000)
    const r = checkRateLimit(k2, 2, 60_000)
    expect(r.allowed).toBe(true)
  })

  it('returns a positive retryAfterSeconds', () => {
    const k = key()
    const r = checkRateLimit(k, 1, 10_000)
    expect(r.retryAfterSeconds).toBeGreaterThan(0)
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(10)
  })
})
