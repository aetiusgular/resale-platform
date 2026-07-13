/**
 * Server-side image hashing via sharp.
 * Node.js runtime only — do NOT import in client components or Edge routes.
 */
import sharp from 'sharp'
import { blockhash16 } from './phash'
import { PHOTO_SLOTS, type PhotoSlot } from './condition'

/**
 * Validate that a URL is safe to fetch for image hashing.
 * Only HTTPS URLs on the configured Supabase storage host are permitted.
 * This prevents SSRF against internal metadata endpoints or VPC hosts.
 */
function isSafeImageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false

  // Restrict to the project's Supabase host so only Storage-resident images
  // can be hashed. This also blocks all RFC-1918 / link-local targets.
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  if (!supabaseHost || parsed.hostname !== supabaseHost) return false

  return true
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

/**
 * Hash all image slots for a listing.
 * @param images   6-element array of image URLs (empty string = unfilled slot)
 * @param possessionUrl  possession photo URL (maps to POSSESSION slot)
 * @returns Map from slot name to hash string (only slots that successfully hashed)
 */
export async function hashAllSlots(
  images: string[],
  possessionUrl: string,
): Promise<Partial<Record<PhotoSlot, string>>> {
  const results: Partial<Record<PhotoSlot, string>> = {}

  // Hash regular slots (indices 0–4: FRONT, BACK, TAG, DETAIL, FLAW)
  const regularSlots = PHOTO_SLOTS.slice(0, 5) as PhotoSlot[]
  const regularHashes = await Promise.all(
    regularSlots.map((_, i) => hashImageUrl(images[i] ?? ''))
  )
  for (let i = 0; i < regularSlots.length; i++) {
    const h = regularHashes[i]
    if (h) results[regularSlots[i]] = h
  }

  // Hash possession slot from its dedicated URL
  const possHash = await hashImageUrl(possessionUrl)
  if (possHash) results['POSSESSION'] = possHash

  return results
}
