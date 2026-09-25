'use client'

/**
 * Search-by-image client state — one module-level store (useSyncExternalStore) shared by the
 * header field and /search/image. The query image lives here as a Blob + object URL for the
 * life of the tab: never written to storage, never in the URL, gone on reload (the page then
 * asks for an image again).
 *
 * Two steps, by founder decision (2026-09-25): attaching an image (picker, paste, ⌘K, drop,
 * the mobile sheet) only STAGES it in the field; the search runs when the user submits
 * (Enter), so the words and the image go up as ONE request instead of an image query
 * followed by a text refinement. `run()` is the ONE place the browser calls
 * POST /api/search/image and the ONE place the recs `search` event fires for image queries.
 */
import { useSyncExternalStore } from 'react'
import { resizeToJpeg } from '@/app/components/resize-image'
import { trackEvent } from '@/lib/analytics'
import { trackSearch } from '@/lib/recs/telemetry'
import {
  QUERY_MAX_EDGE_PX, isAcceptedImage, normalizeQueryText,
  type VisualQuery, type VisualSearchApiResponse,
} from './shared'

/** idle → staged (image attached, nothing sent) → searching → ready | error. */
export type VisualStatus = 'idle' | 'staged' | 'searching' | 'ready' | 'error'

export interface VisualState {
  status: VisualStatus
  /** The (resized) query image and its object URL for thumbnails; null when nothing is loaded. */
  image: { blob: Blob; url: string } | null
  query: VisualQuery
  response: VisualSearchApiResponse | null
  /** User-facing error line (mono, upper-case in the UI). */
  error: string | null
  /** Bumps on every completed search, so pages can react to a new result set. */
  seq: number
  /** Bumps on every staged image, so the field can focus its input for the words. */
  stagedSeq: number
}

const EMPTY_QUERY: VisualQuery = { category: null, autoCategory: true, text: '' }
const INITIAL: VisualState = { status: 'idle', image: null, query: EMPTY_QUERY, response: null, error: null, seq: 0, stagedSeq: 0 }

let state: VisualState = INITIAL
const listeners = new Set<() => void>()
let inflight: AbortController | null = null

function emit(next: Partial<VisualState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = () => state
const getServerSnapshot = () => INITIAL

export function useVisualSearch(): VisualState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function visualSearchState(): VisualState {
  return state
}

/** Drop the query image and results (the × in the field, NEW SEARCH). */
export function clearVisualSearch(): void {
  inflight?.abort()
  inflight = null
  if (state.image) URL.revokeObjectURL(state.image.url)
  emit({ status: 'idle', image: null, query: EMPTY_QUERY, response: null, error: null })
}

/** Cancel an in-flight search (the × on the SEARCHING… chip). Keeps nothing. */
export function cancelVisualSearch(): void {
  clearVisualSearch()
}

function errorLine(status: number): string {
  if (status === 413) return 'IMAGE TOO LARGE · 5 MB MAX'
  if (status === 415) return 'JPEG, PNG OR WEBP ONLY'
  if (status === 429) return 'TOO MANY SEARCHES · TRY AGAIN IN A MINUTE'
  if (status === 401) return 'SIGN IN TO SEARCH BY IMAGE'
  if (status === 404) return 'SEARCH BY IMAGE IS OFF'
  return 'SEARCH FAILED · TRY AGAIN'
}

async function prepare(file: Blob): Promise<Blob> {
  // Screenshots and camera captures are large; the client resizes to ≤ 768 px JPEG first.
  // Anything that fails to decode falls through to the raw bytes and the server's checks.
  try {
    return await resizeToJpeg(file, QUERY_MAX_EDGE_PX, 0.9)
  } catch {
    return file
  }
}

/**
 * Attach an image to the field (picker / paste / ⌘K / drop / mobile sheet). Nothing is sent:
 * the user adds words if they want and submits. Resolves true when the image was accepted.
 */
export async function stageVisualImage(file: Blob): Promise<boolean> {
  if (file.type && !isAcceptedImage(file.type)) {
    emit({ status: state.image ? state.status : 'idle', error: 'JPEG, PNG OR WEBP ONLY' })
    return false
  }
  inflight?.abort()
  inflight = null
  const blob = await prepare(file)
  if (state.image) URL.revokeObjectURL(state.image.url)
  emit({
    status: 'staged',
    image: { blob, url: URL.createObjectURL(blob) },
    query: EMPTY_QUERY,
    response: null,
    error: null,
    stagedSeq: state.stagedSeq + 1,
  })
  return true
}

/**
 * Run the search with the attached image and the given words (Enter in the field). Also
 * the re-query on the results page: new words, a category pick, ALL CATEGORIES. Resolves
 * true on success, false on failure or cancel; the state carries the details either way.
 */
export async function runVisualSearch(patch: Partial<VisualQuery> = {}): Promise<boolean> {
  if (!state.image) return false
  const next: VisualQuery = { ...state.query, ...patch }
  next.text = normalizeQueryText(next.text)
  return run(state.image, next)
}

async function run(image: { blob: Blob; url: string }, query: VisualQuery): Promise<boolean> {
  inflight?.abort()
  const controller = new AbortController()
  inflight = controller
  emit({ status: 'searching', image, query, error: null })

  const qs = new URLSearchParams()
  if (query.text) qs.set('q', query.text)
  if (query.category) qs.set('category', query.category)
  if (!query.autoCategory) qs.set('auto_category', '0')
  const url = `/api/search/image${qs.toString() ? `?${qs}` : ''}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': image.blob.type || 'image/jpeg' },
      body: image.blob,
      signal: controller.signal,
    })
    if (inflight !== controller) return false // superseded
    if (!res.ok) {
      emit({ status: 'error', error: errorLine(res.status) })
      return false
    }
    const body = (await res.json()) as VisualSearchApiResponse
    const mode = query.text ? 'image+text' : 'image'
    // recs telemetry (hashed text; the image never leaves the request) + product analytics
    trackSearch(query.text || 'image', {
      mode, category: body.category ?? '', category_source: body.category_source ?? '',
    })
    trackEvent('visual_search_performed', {
      mode, has_text: Boolean(query.text), category: body.category ?? '', category_source: body.category_source ?? '',
      listed: body.listed, exact: body.exact.length, match: body.match.length, close: body.close.length,
      engine: body.engine,
    })
    emit({ status: 'ready', response: body, query, error: null, seq: state.seq + 1 })
    return true
  } catch (err) {
    if (controller.signal.aborted) return false
    emit({ status: 'error', error: err instanceof Error && err.name === 'AbortError' ? null : 'SEARCH FAILED · TRY AGAIN' })
    return false
  } finally {
    if (inflight === controller) inflight = null
  }
}
