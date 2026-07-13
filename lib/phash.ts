/**
 * 16x16 blockhash — perceptual hash implementation.
 * Pure JS, no external dependencies.
 *
 * Algorithm:
 *   1. Accept 256 grayscale pixel values as a Uint8Array (16x16).
 *   2. Compute mean luminance across all pixels.
 *   3. Bit i = (pixels[i] > mean) ? 1 : 0.
 *   4. Pack 256 bits into 32 bytes; return as 64-char lowercase hex.
 *
 * Caller is responsible for resizing + grayscaling the image to 16x16
 * before passing pixel data. See lib/image-hash.ts for the sharp-based helper.
 */
export function blockhash16(pixels: Uint8Array): string {
  if (pixels.length !== 256) {
    throw new Error(`blockhash16: expected 256 pixels, got ${pixels.length}`)
  }

  // Mean luminance
  let sum = 0
  for (let i = 0; i < 256; i++) sum += pixels[i]
  const mean = sum / 256

  // Pack bits: bit i is set if pixels[i] > mean
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 256; i++) {
    if (pixels[i] > mean) {
      bytes[i >> 3] |= 1 << (7 - (i & 7))
    }
  }

  return Buffer.from(bytes).toString('hex')
}

/**
 * Hamming distance between two 64-char hex hashes.
 * Returns number of differing bits (0–256).
 * Returns 256 if hashes have different lengths.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 256

  let dist = 0
  for (let i = 0; i < a.length; i += 2) {
    // XOR each byte, then count set bits (popcount)
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)
    // Brian Kernighan / Wegner popcount for 8-bit value
    x = x - ((x >> 1) & 0x55)
    x = (x & 0x33) + ((x >> 2) & 0x33)
    dist += (x + (x >> 4)) & 0x0f
  }
  return dist
}
