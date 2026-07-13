import { describe, it, expect } from 'vitest'
import { blockhash16, hammingDistance } from '../../lib/phash'

/**
 * NOTE: blockhash16 uses a mean-threshold algorithm.
 * Solid-color images (every pixel the same value) all hash identically to
 * all-zeros because every pixel equals the mean, triggering zero bits.
 * Tests must use patterned images with actual luminance variation.
 */

/** Top 128 pixels bright (255), bottom 128 pixels dark (0). Mean = 127.5. */
function topBright(): Uint8Array {
  return new Uint8Array(256).map((_, i) => (i < 128 ? 255 : 0))
}

/** Top 128 pixels dark (0), bottom 128 pixels bright (255). Mean = 127.5. */
function topDark(): Uint8Array {
  return new Uint8Array(256).map((_, i) => (i < 128 ? 0 : 255))
}

/** Left 8 columns bright, right 8 columns dark (16x16 layout). Mean = 127.5. */
function leftBright(): Uint8Array {
  // pixel index i → row = floor(i/16), col = i%16
  return new Uint8Array(256).map((_, i) => (i % 16 < 8 ? 255 : 0))
}

/** Checkerboard pattern: alternating 0 and 255. */
function checkerboard(): Uint8Array {
  return new Uint8Array(256).map((_, i) => (i % 2 === 0 ? 255 : 0))
}

/** Inverted checkerboard. */
function invertedCheckerboard(): Uint8Array {
  return new Uint8Array(256).map((_, i) => (i % 2 === 0 ? 0 : 255))
}

/** Copy pixels and perturb N pixel values slightly (deterministic). */
function perturb(pixels: Uint8Array, count: number, delta = 10): Uint8Array {
  const copy = new Uint8Array(pixels)
  for (let i = 0; i < count; i++) {
    const idx = (i * 37) % 256 // deterministic spread
    copy[idx] = Math.min(255, Math.max(0, copy[idx] + delta))
  }
  return copy
}

describe('blockhash16', () => {
  it('throws on wrong pixel count', () => {
    expect(() => blockhash16(new Uint8Array(100))).toThrow('256')
  })

  it('returns 64-char hex string', () => {
    const hash = blockhash16(checkerboard())
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same pixels always produce same hash', () => {
    const px = checkerboard()
    expect(blockhash16(px)).toBe(blockhash16(px))
    expect(blockhash16(topBright())).toBe(blockhash16(topBright()))
  })

  it('top-bright image produces different hash from top-dark image', () => {
    // Both have mean 127.5; different pixels are above mean → different hashes
    expect(blockhash16(topBright())).not.toBe(blockhash16(topDark()))
  })

  it('checkerboard and inverted checkerboard differ significantly', () => {
    const dist = hammingDistance(blockhash16(checkerboard()), blockhash16(invertedCheckerboard()))
    // Inverted pattern flips every bit → maximum distance
    expect(dist).toBeGreaterThan(100)
  })
})

describe('hammingDistance', () => {
  it('identical hashes → distance 0', () => {
    const h = blockhash16(checkerboard())
    expect(hammingDistance(h, h)).toBe(0)
  })

  it('returns 256 for mismatched lengths', () => {
    expect(hammingDistance('aa', 'bbbb')).toBe(256)
  })

  it('all-zeros vs all-ones → maximum distance (256)', () => {
    const zeros = '0'.repeat(64)
    const ones  = 'f'.repeat(64)
    expect(hammingDistance(zeros, ones)).toBe(256)
  })

  it('near-duplicate: small perturbation → small distance (≤8)', () => {
    // Perturbing 5 pixels on a 256-pixel checkerboard shifts only a few bits
    const original  = checkerboard()
    const perturbed = perturb(original, 5, 10)
    const dist = hammingDistance(blockhash16(original), blockhash16(perturbed))
    expect(dist).toBeLessThanOrEqual(8)
  })

  it('completely different images → large distance (>100)', () => {
    // topBright and topDark are structurally opposite: every bit flipped
    const dist = hammingDistance(blockhash16(topBright()), blockhash16(topDark()))
    expect(dist).toBeGreaterThan(100)
  })

  it('symmetric: d(a,b) === d(b,a)', () => {
    const hA = blockhash16(checkerboard())
    const hB = blockhash16(leftBright())
    expect(hammingDistance(hA, hB)).toBe(hammingDistance(hB, hA))
  })
})

describe('duplicate detection logic', () => {
  it('identical image sets re-uploaded: all slots distance 0 → flagged', () => {
    const h = blockhash16(checkerboard())
    const slots = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW', 'POSSESSION']
    const newHashes:   Record<string, string> = {}
    const existHashes: Record<string, string> = {}
    for (const slot of slots) { newHashes[slot] = h; existHashes[slot] = h }

    const matches = slots.filter(s => hammingDistance(newHashes[s], existHashes[s]) <= 8)
    expect(matches.length).toBeGreaterThanOrEqual(2) // triggers flag
  })

  it('near-duplicate re-encoded image: small perturbation still detected', () => {
    // Simulates a re-encoded or slightly cropped version of the same image
    const original  = topBright()
    const reEncoded = perturb(original, 3, 8) // 3 pixels shifted slightly
    const dist = hammingDistance(blockhash16(original), blockhash16(reEncoded))
    expect(dist).toBeLessThanOrEqual(8) // within duplicate threshold
  })

  it('distinct fixture images: distance large → not flagged', () => {
    // topBright vs topDark are structurally opposite; no near-match
    const hA = blockhash16(topBright())
    const hB = blockhash16(topDark())
    expect(hammingDistance(hA, hB)).toBeGreaterThan(8) // would NOT trigger flag
  })

  it('phash is deterministic across calls', () => {
    const px = topBright()
    const h1 = blockhash16(new Uint8Array(px))
    const h2 = blockhash16(new Uint8Array(px))
    expect(h1).toBe(h2)
  })
})
