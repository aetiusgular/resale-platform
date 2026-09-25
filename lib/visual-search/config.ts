/**
 * Visual search (search-by-image) configuration — server side.
 *
 * The engine endpoint lives on the recs feed service (same host, same bearer token): the
 * photo index and the encoder sit next to the feed on the VPS, so there are no new secrets.
 * Flags live in lib/flags.ts (house pattern, off by default); this module holds the tunables.
 */
import { recsConfig } from '@/lib/recs/config'

export { VISUAL_SEARCH_ENABLED, VISUAL_SEARCH_PUBLIC_ENABLED } from '@/lib/flags'

// Guests may search by image (rate-limited by IP). Set 'false' to require a signed-in user.
export const VISUAL_SEARCH_GUESTS = process.env.VISUAL_SEARCH_GUESTS !== 'false'

/** Upload cap in bytes; the client resizes to <=768 px JPEG first, so real uploads are ~100 KB. */
export const VISUAL_SEARCH_MAX_BYTES = 5 * 1024 * 1024

/** Hamming distance (of 256 bits) at or under which two blockhashes are "the same photo". */
export const VISUAL_SEARCH_EXACT_HAMMING = Number(process.env.VISUAL_SEARCH_EXACT_HAMMING ?? 12)

/** Widest Hamming distance the hash RPC returns; the merge decides exact vs close. */
export const VISUAL_SEARCH_HASH_MAX_DISTANCE = 64

/** Rows to ask the hash RPC for; a listing can contribute several slots. */
export const VISUAL_SEARCH_HASH_ROWS = 60

/** Per-caller rate limit (user id, else IP): searches per window. */
export const VISUAL_SEARCH_RATE_LIMIT = 20
export const VISUAL_SEARCH_RATE_WINDOW_MS = 60_000

/** Engine call budget. Encode + grouped ANN is ~100-300 ms on the box; the rest is transit. */
export const VISUAL_SEARCH_TIMEOUT_MS = Number(process.env.VISUAL_SEARCH_TIMEOUT_MS ?? 4000)

/** Results the route returns across all tiers (cards are hydrated for these only). */
export const VISUAL_SEARCH_MAX_RESULTS = 40

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

/** Engine base URL + token (the recs feed service). Null when recs is not configured. */
export function visualEngine(): { url: string; token: string } | null {
  const url = recsConfig.feedUrl
  const token = recsConfig.feedToken
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ''), token }
}
