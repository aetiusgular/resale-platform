import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { hammingDistance } from '@/lib/phash'

// The stored (publish-time) and query (search-time) blockhashes must come from ONE pipeline:
// a query hashed any other way never lands at distance 0 on its own listing photo.
vi.mock('@/lib/security/image-url', () => ({
  storageHost: () => 'proj.supabase.co',
  isAllowedImageUrl: (u: string) => u.startsWith('https://proj.supabase.co/'),
}))

const { blockhashFromBuffer, hashImageUrl } = await import('@/lib/image-hash')
const { blockhashFromBuffer: queryHash } = await import('@/lib/visual-search/image')

/** 64x32 left-to-right gradient with a bright block top-left: asymmetric under rotation. */
async function samplePng(): Promise<Buffer> {
  const w = 64, h = 32
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < 16 && y < 12 ? 255 : Math.round((x / (w - 1)) * 200)
      raw.set([v, v, v], (y * w + x) * 3)
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

afterEach(() => vi.unstubAllGlobals())

describe('blockhash pipeline (lib/image-hash)', () => {
  it('hashes a stored photo (by URL) and the same bytes as a query identically', async () => {
    const png = await samplePng()
    const body = new Blob([new Uint8Array(png).buffer as ArrayBuffer]) // a fresh copy: Buffer memory is pooled
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const stored = await hashImageUrl('https://proj.supabase.co/storage/v1/object/public/product-images/x/p-1.png')
    const query = await queryHash(png)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(query).toBe(stored)
    expect(await blockhashFromBuffer(png)).toBe(stored)
  })

  it('applies EXIF orientation, so a tagged phone photo hashes like the upright one', async () => {
    const png = await samplePng()
    const upright = await sharp(png).rotate(90).png().toBuffer() // pixels rotated, no tag
    const tagged = await sharp(png).withMetadata({ orientation: 6 }).jpeg({ quality: 100 }).toBuffer() // tag only
    const [hUpright, hTagged, hPlain] = await Promise.all([
      blockhashFromBuffer(upright), blockhashFromBuffer(tagged), blockhashFromBuffer(png),
    ])
    expect(hUpright && hTagged && hPlain).toBeTruthy()
    expect(hammingDistance(hTagged!, hUpright!)).toBeLessThanOrEqual(4) // JPEG re-encode noise only
    expect(hammingDistance(hTagged!, hPlain!)).toBeGreaterThan(32) // the rotation was applied
  })

  it('returns null for bytes that do not decode and for oversize queries', async () => {
    expect(await blockhashFromBuffer(Buffer.from('not an image'))).toBeNull()
    const png = await samplePng()
    expect(await blockhashFromBuffer(png, { limitInputPixels: 100 })).toBeNull()
  })
})
