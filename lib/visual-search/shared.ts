/**
 * Visual search — isomorphic, PURE helpers shared by the header field, the results page
 * and the route (no env, no DOM at import time). Unit-tested in
 * tests/unit/visual-search-shared.test.ts.
 */
import type { MergedHit, VisualTier } from './merge'
import type { BrowseListing } from '@/lib/loaders/browse'

/** Client-side resize edge before upload (design: ≤ 768 px JPEG, ~100 KB). */
export const QUERY_MAX_EDGE_PX = 768
/** Longest text that may ride along with an image (mirrors the engine's `max_text_chars`). */
export const QUERY_MAX_TEXT_CHARS = 200
/** Containers the route accepts; the client refuses anything else before uploading. */
export const QUERY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type CategorySource = 'explicit' | 'guess' | null

/** What `POST /api/search/image` returns (see app/api/search/image/route.ts). */
export type VisualSearchHit = MergedHit & { matched_photo: string; listing: BrowseListing }
export type VisualSearchApiResponse = {
  listed: boolean
  category: string | null
  category_source: CategorySource
  text: string | null
  engine: 'ok' | 'unavailable'
  exact: VisualSearchHit[]
  match: VisualSearchHit[]
  close: VisualSearchHit[]
  saved_ids: string[]
}

/** The query the client holds in memory (never persisted; a reload forgets it). */
export type VisualQuery = {
  /** Explicit category filter (chip pick); null lets the engine guess (auto) or run unfiltered. */
  category: string | null
  /** false after ALL CATEGORIES: no filter and no zero-shot guess. */
  autoCategory: boolean
  /** Text typed next to the image; the engine fuses it into the close-tier query. */
  text: string
}

/** Trim + cap the text the user typed; empty → '' (the route sends nothing then). */
export function normalizeQueryText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX_TEXT_CHARS)
}

/**
 * The first image file in a paste or drop. `DataTransfer.files` covers drops and file
 * pastes; `items` covers screenshots pasted from the clipboard (kind 'file', an image
 * type, and a `getAsFile()` that yields a File with an empty name).
 */
export function pickImageFile(dt: Pick<DataTransfer, 'files' | 'items'> | null | undefined): File | null {
  if (!dt) return null
  const files = dt.files ? Array.from(dt.files) : []
  const fromFiles = files.find((f) => isAcceptedImage(f.type))
  if (fromFiles) return fromFiles
  const items = dt.items ? Array.from(dt.items) : []
  for (const item of items) {
    if (item.kind !== 'file' || !isAcceptedImage(item.type)) continue
    const f = item.getAsFile()
    if (f) return f
  }
  return null
}

export function isAcceptedImage(type: string): boolean {
  return (QUERY_IMAGE_TYPES as readonly string[]).includes(type.toLowerCase())
}

/** Whether a paste/keystroke landed in something the user is typing into. */
export function isEditableTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (el as HTMLElement).isContentEditable === true
}

/** "⌘V" on Apple platforms, "CTRL+V" elsewhere (the S1 hint and the S2 placeholder). */
export function pasteKeyLabel(platform: string | null | undefined): string {
  return /mac|iphone|ipad|ipod/i.test(platform ?? '') ? '⌘V' : 'CTRL+V'
}

export type ResultCounts = { exact: number; match: number; close: number }

export function countTiers(res: Pick<VisualSearchApiResponse, 'exact' | 'match' | 'close'>): ResultCounts {
  return { exact: res.exact.length, match: res.match.length, close: res.close.length }
}

/**
 * The results head: `{ lead, meta }` — "2" + "matches · 6 close in Outerwear" when listed,
 * "Not listed." + "These are the closest pieces · 6 close in Outerwear" when not (R1 / R2).
 */
export function resultsHeadline(counts: ResultCounts, category: string | null): { lead: string; meta: string } {
  const matches = counts.exact + counts.match
  const where = category ? ` in ${category}` : ''
  const closePart = `${counts.close} close${where}`
  if (matches > 0) {
    return { lead: String(matches), meta: `${matches === 1 ? 'match' : 'matches'} · ${closePart}` }
  }
  return { lead: 'Not listed.', meta: `These are the closest pieces · ${closePart}` }
}

/** Order of tiers on the page: matches (exact then match) first, then close. */
export function tierOrder(): VisualTier[] {
  return ['exact', 'match', 'close']
}
