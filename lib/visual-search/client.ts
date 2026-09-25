/**
 * recs-engine visual search client — SERVER ONLY (holds the feed bearer token).
 * FAIL-SOFT like lib/recs/client.ts: any failure (disabled, unreachable, timeout, non-2xx,
 * bad JSON) returns null and the route answers with the hash tier only.
 */
import { VISUAL_SEARCH_TIMEOUT_MS, visualEngine } from './config'
import type { EngineVisualResponse } from './merge'

async function timedFetch(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISUAL_SEARCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function parse(res: Response | null): Promise<EngineVisualResponse | null> {
  if (!res || !res.ok) return null
  try {
    const body = (await res.json()) as EngineVisualResponse
    if (!Array.isArray(body.results)) return null
    return body
  } catch {
    return null
  }
}

export interface EngineSearchOptions {
  categories?: string[]
  limit?: number
  /** Text typed next to the image: the engine fuses it into the close-tier query. */
  text?: string | null
  /** false ⇒ no zero-shot category guess (ALL CATEGORIES); the engine defaults to true. */
  autoCategory?: boolean
}

function query(opts: EngineSearchOptions): string {
  const qs = new URLSearchParams()
  for (const c of opts.categories ?? []) qs.append('category', c)
  if (opts.limit) qs.set('limit', String(opts.limit))
  if (opts.text) qs.set('text', opts.text)
  if (opts.autoCategory === false) qs.set('auto_category', 'false')
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** POST the raw image body to `/v1/search/image`. */
export async function engineSearchByImage(
  image: Buffer,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp',
  opts: EngineSearchOptions = {},
): Promise<EngineVisualResponse | null> {
  const engine = visualEngine()
  if (!engine) return null
  const res = await timedFetch(`${engine.url}/v1/search/image${query(opts)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${engine.token}`,
      'Content-Type': contentType,
      'Content-Length': String(image.byteLength),
    },
    body: new Uint8Array(image),
  })
  return parse(res)
}

/** "Search with this listing's photo": the engine reuses the indexed vector, no upload. */
export async function engineSearchByListingPhoto(
  listingId: string,
  photoIndex: number,
  opts: EngineSearchOptions = {},
): Promise<EngineVisualResponse | null> {
  const engine = visualEngine()
  if (!engine) return null
  const res = await timedFetch(`${engine.url}/v1/search/image/listing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${engine.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listing_id: listingId,
      photo_index: photoIndex,
      categories: opts.categories ?? [],
      limit: opts.limit ?? null,
      text: opts.text || null,
      auto_category: opts.autoCategory ?? false,
    }),
  })
  return parse(res)
}
