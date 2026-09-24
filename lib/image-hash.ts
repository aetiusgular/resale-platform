/**
 * Server-side image hashing via sharp.
 * Node.js runtime only — do NOT import in client components or Edge routes.
 */
import sharp from 'sharp'
import { blockhash16 } from './phash'
import { isAllowedImageUrl, storageHost } from './security/image-url'
import { MAX_PHOTOS, photoSlotName, POSSESSION_SLOT } from './listings/images'

/**
 * Validate that a URL is safe to fetch for image hashing.
 * Only HTTPS URLs on the configured Supabase storage host are permitted.
 * This prevents SSRF against internal metadata endpoints or VPC hosts.
 */
function isSafeImageUrl(url: string): boolean {
  return isAllowedImageUrl(url, storageHost())
}

/**
 * Fetch a public Supabase Storage image URL and compute its 16x16 blockhash.
 * Returns null if the URL is empty, unsafe, unreachable, or processing fails.
 * Only accepts HTTPS URLs from the project's Supabase storage domain (SSRF guard).
 */
export async function hashImageUrl(url: string): Promise<string | null> {
  if (!url || !url.trim()) return null
  if (!isSafeImageUrl(url)) {
    console.warn('[image-hash] rejected unsafe URL scheme/host:', new URL(url).hostname)
    return null
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'resale-platform/antislop-hasher' },
    })
    if (!res.ok) {
      console.warn('[image-hash] fetch failed:', res.status, url.slice(0, 80))
      return null
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const { data } = await sharp(buffer)
      .resize(16, 16, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return blockhash16(new Uint8Array(data))
  } catch {
    return null
  }
}

export { photoSlotName, POSSESSION_SLOT } from './listings/images'

/**
 * Hash every photo of a listing, plus the possession proof when there is one.
 * @param images   the seller's ordered public photos (up to MAX_PHOTOS)
 * @param possessionUrl  possession proof URL ('' when none)
 * @returns image_hashes.slot → hash (only the images that hashed). Rows written by the old
 *   six-slot form used FRONT / BACK / TAG / DETAIL / FLAW; the near-duplicate scan is
 *   slot-agnostic, so both namings compare.
 */
export async function hashAllSlots(
  images: string[],
  possessionUrl: string,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  const list = images.slice(0, MAX_PHOTOS)
  const hashes = await Promise.all(list.map((u) => hashImageUrl(u ?? '')))
  hashes.forEach((h, i) => { if (h) results[photoSlotName(i)] = h })

  const possHash = await hashImageUrl(possessionUrl)
  if (possHash) results[POSSESSION_SLOT] = possHash

  return results
}
