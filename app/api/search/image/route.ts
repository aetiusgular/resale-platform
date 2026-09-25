/**
 * POST /api/search/image — search the marketplace by photo (visual search P1).
 *
 * Two input shapes:
 *   - raw image body (Content-Type image/jpeg|png|webp, <= 5 MB; the client resizes to
 *     <= 768 px first): the upload is hashed here (16x16 blockhash → `similar_image_hashes`
 *     RPC = the "same photo" tier) and forwarded to recs-engine (`POST /v1/search/image` = the
 *     embedding tiers). The bytes stay in memory for this request and are never stored.
 *   - JSON `{ listing_id, photo_index }`: "search with this listing's photo". The engine reuses
 *     the indexed vector and the hash tier uses the stored hash. No upload.
 *
 * Response `{ listed, category, engine, exact, match, close }`: one entry per listing, in its
 * best tier, each carrying a BrowseListing card (active listings with a public photo only) and
 * `matched_photo`, the listing image that matched. FAIL-SOFT: engine down ⇒ hash tier only and
 * `engine: 'unavailable'`. Gated by VISUAL_SEARCH_ENABLED (404 when off); guests allowed when
 * VISUAL_SEARCH_GUESTS, rate-limited by IP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, enforceRateLimit, notFound, respond } from '@/lib/api/respond'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import { publicImages } from '@/lib/listings/images'
import type { BrowseListing } from '@/lib/loaders/browse'
import { isAllowedImageUrl, storageHost } from '@/lib/security/image-url'
import {
  VISUAL_SEARCH_ENABLED,
  VISUAL_SEARCH_EXACT_HAMMING,
  VISUAL_SEARCH_GUESTS,
  VISUAL_SEARCH_HASH_MAX_DISTANCE,
  VISUAL_SEARCH_HASH_ROWS,
  VISUAL_SEARCH_MAX_BYTES,
  VISUAL_SEARCH_MAX_RESULTS,
  VISUAL_SEARCH_RATE_LIMIT,
  VISUAL_SEARCH_RATE_WINDOW_MS,
} from '@/lib/visual-search/config'
import { engineSearchByImage, engineSearchByListingPhoto } from '@/lib/visual-search/client'
import { blockhashFromBuffer, isBlockhashHex, sniffImageType } from '@/lib/visual-search/image'
import { mergeVisualResults, type HashHit, type MergedHit } from '@/lib/visual-search/merge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Same columns as the browse loader, so the results page reuses the browse card. */
const CARD_SELECT = `
  id, title, brand, category, department, subcategory, size, color,
  condition_score, price_cents, saves_count, is_price_dropped, authentication_status, status,
  images, created_at, seller_id, possession_photo_url,
  profiles:seller_id (username, id_verification_status)
`

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PHOTO_INDEX = 14 // listings.images holds up to 15 photos

type Service = ReturnType<typeof createServiceClientRaw>

type RawCard = {
  id: string; title: string; brand: string; category: string; department: string; subcategory: string | null
  size: string; color: string | null; condition_score: number; price_cents: number; saves_count: number
  is_price_dropped: boolean; authentication_status: string; status: string; images: unknown; created_at: string
  seller_id: string; possession_photo_url: string | null
  profiles: { username: string; id_verification_status: string } | null
}

export type VisualSearchHit = MergedHit & { matched_photo: string; listing: BrowseListing }

function parseCategories(req: NextRequest): string[] {
  return req.nextUrl.searchParams
    .getAll('category')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c.length <= 64)
    .slice(0, 8)
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim()
}

export async function POST(req: NextRequest) {
  if (!VISUAL_SEARCH_ENABLED) return notFound()
  return respond(async () => {
    // ── who is asking ────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !VISUAL_SEARCH_GUESTS) throw new ApiError(401, 'Sign in to search by photo', 'auth_required')
    await enforceRateLimit(
      `visual-search:${user ? `u:${user.id}` : `ip:${clientIp(req)}`}`,
      VISUAL_SEARCH_RATE_LIMIT,
      VISUAL_SEARCH_RATE_WINDOW_MS,
    )

    const categories = parseCategories(req)
    const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const service = createServiceClientRaw()
    const engineOpts = { categories, limit: VISUAL_SEARCH_MAX_RESULTS }

    let hashHits: HashHit[] = []
    let engine = null

    if (contentType === 'application/json') {
      // ── "search with this listing's photo" ─────────────────────────────────
      let body: { listing_id?: unknown; photo_index?: unknown }
      try {
        body = (await req.json()) as { listing_id?: unknown; photo_index?: unknown }
      } catch {
        throw new ApiError(400, 'Malformed JSON body', 'bad_json')
      }
      const listingId = typeof body.listing_id === 'string' ? body.listing_id : ''
      const photoIndex = typeof body.photo_index === 'number' && Number.isInteger(body.photo_index) ? body.photo_index : 0
      if (!UUID_RE.test(listingId) || photoIndex < 0 || photoIndex > MAX_PHOTO_INDEX) {
        throw new ApiError(400, 'listing_id (uuid) and photo_index (0-14) required', 'bad_listing_ref')
      }
      const [hashRow, engineResponse] = await Promise.all([
        service
          .from('image_hashes')
          .select('hash')
          .eq('listing_id', listingId)
          .eq('slot', `PHOTO_${photoIndex + 1}`)
          .maybeSingle(),
        engineSearchByListingPhoto(listingId, photoIndex, engineOpts),
      ])
      engine = engineResponse
      const queryHash = (hashRow.data as { hash?: string } | null)?.hash ?? null
      if (queryHash && isBlockhashHex(queryHash)) hashHits = await hashTier(service, queryHash, listingId)
    } else {
      // ── raw upload ──────────────────────────────────────────────────────────
      const declared = Number(req.headers.get('content-length') ?? 0)
      if (declared > VISUAL_SEARCH_MAX_BYTES) throw new ApiError(413, 'Image exceeds 5 MB', 'image_too_large')
      const bytes = Buffer.from(await req.arrayBuffer())
      if (bytes.byteLength === 0) throw new ApiError(400, 'Empty image body', 'empty_image')
      if (bytes.byteLength > VISUAL_SEARCH_MAX_BYTES) throw new ApiError(413, 'Image exceeds 5 MB', 'image_too_large')
      const sniffed = sniffImageType(bytes)
      if (!sniffed) throw new ApiError(415, 'Send a JPEG, PNG or WebP image', 'unsupported_image_type')
      const [queryHash, engineResponse] = await Promise.all([
        blockhashFromBuffer(bytes),
        engineSearchByImage(bytes, sniffed, engineOpts),
      ])
      engine = engineResponse
      if (queryHash) hashHits = await hashTier(service, queryHash, null)
    }

    const merged = mergeVisualResults({ hashHits, engine, exactHamming: VISUAL_SEARCH_EXACT_HAMMING })
    const cards = await hydrate(service, [...merged.exact, ...merged.match, ...merged.close], user?.id ?? null)
    const exact = attach(merged.exact, cards)
    const match = attach(merged.match, cards)
    const close = attach(merged.close, cards)

    return NextResponse.json({
      // `listed` describes what the response carries: a hit that hydration dropped (pending
      // review, sold since indexing, no public photo) must not leave the UI saying "listed"
      // over an empty tier.
      listed: exact.length + match.length > 0,
      category: merged.category,
      engine: merged.engine,
      exact,
      match,
      close,
    })
  })
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function hashTier(service: Service, queryHash: string, excludeListing: string | null): Promise<HashHit[]> {
  const { data, error } = await service.rpc('similar_image_hashes', {
    query_hex: queryHash,
    max_distance: VISUAL_SEARCH_HASH_MAX_DISTANCE, // wide net; the merge decides exact vs close
    max_rows: VISUAL_SEARCH_HASH_ROWS,
    exclude_listing: excludeListing,
    exclude_seller: null,
  })
  if (error || !Array.isArray(data)) return []
  return (data as HashHit[]).filter(
    (r) => typeof r.listing_id === 'string' && typeof r.slot === 'string' && Number.isFinite(r.distance),
  )
}

async function hydrate(service: Service, hits: MergedHit[], viewerId: string | null): Promise<Map<string, BrowseListing>> {
  const ids = [...new Set(hits.map((h) => h.listing_id))].slice(0, VISUAL_SEARCH_MAX_RESULTS * 2)
  const cards = new Map<string, BrowseListing>()
  if (ids.length === 0) return cards
  const { data } = await service.from('listings').select(CARD_SELECT).in('id', ids).eq('status', 'active')
  const host = storageHost()
  for (const l of (data ?? []) as unknown as RawCard[]) {
    const images = publicImages(l.images, l.possession_photo_url).filter((u) => isAllowedImageUrl(u, host))
    if (images.length === 0) continue // never surface a listing without a public photo
    cards.set(l.id, {
      id: l.id,
      title: l.title,
      brand: l.brand,
      category: l.category,
      department: l.department,
      subcategory: l.subcategory ?? null,
      size: l.size,
      color: l.color ?? null,
      condition_score: l.condition_score,
      price_cents: l.price_cents,
      saves_count: l.saves_count,
      is_price_dropped: l.is_price_dropped,
      images,
      created_at: l.created_at,
      seller: l.profiles,
      authentication_status: l.authentication_status,
      sold: false,
      own: !!viewerId && l.seller_id === viewerId,
      original_price_cents: null,
      price_display: formatCents(l.price_cents),
      promoted: false,
    })
  }
  return cards
}

function attach(hits: MergedHit[], cards: Map<string, BrowseListing>): VisualSearchHit[] {
  const out: VisualSearchHit[] = []
  for (const hit of hits) {
    const listing = cards.get(hit.listing_id)
    if (!listing) continue // not active any more, or no public photo
    const idx = hit.photo_index !== null && hit.photo_index >= 0 && hit.photo_index < listing.images.length ? hit.photo_index : 0
    out.push({ ...hit, photo_index: idx, matched_photo: listing.images[idx], listing })
    if (out.length >= VISUAL_SEARCH_MAX_RESULTS) break
  }
  return out
}
