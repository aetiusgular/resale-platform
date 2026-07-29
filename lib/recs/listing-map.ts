/**
 * Map a platform `listings` row → a recs-engine `ListingChange` (the POST /v1/listings
 * webhook payload). PURE — no I/O, no Supabase client. The listing lifecycle routes
 * call these, then hand the result to `postListingChange` (fail-soft).
 *
 * Photo slots already hold full Supabase public URLs (sell-form uploads via
 * `storage.getPublicUrl`), and the recs `load_image` adapter fetches http(s) URLs
 * directly — so `photo_paths` is just the non-empty slots in order.
 */
import type { ListingChange, ListingPayload } from './types'

/** The subset of a `listings` row needed to build a recs ListingChange. */
export interface ListingRowForRecs {
  id: string
  brand: string
  category: string
  price_cents: number
  size?: string | null
  condition_score?: number | null
  created_at: string // ISO-8601, tz-aware
  images: string[] // 6 photo slots; '' for unfilled; filled slots are public URLs
  aesthetic_tags?: string[] | null
  seller_rating?: number | null // 0..5 (from G9 reviews aggregate; omit until it exists)
}

/** recs caps photos at 16; the FRONT slot stays index 0 (primary_index). */
export const MAX_RECS_PHOTOS = 16

/** Integer cents → positive dollar amount for the recs payload (price must be > 0). */
export function centsToPrice(cents: number): number {
  return Math.round(cents) / 100
}

/** Non-empty photo URLs in slot order, capped at the recs limit. */
export function photoPaths(images: readonly string[]): string[] {
  return images
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, MAX_RECS_PHOTOS)
}

function toPayload(row: ListingRowForRecs): ListingPayload {
  const payload: ListingPayload = {
    brand: row.brand,
    category: row.category,
    price: centsToPrice(row.price_cents),
    listed_at: row.created_at,
  }
  // Only attach optional fields when present — keep the payload lean; the recs
  // schema is extra="forbid", so never invent fields it doesn't declare.
  if (row.size) payload.size = row.size
  if (typeof row.condition_score === 'number') payload.condition = `${row.condition_score}/10`
  if (row.aesthetic_tags && row.aesthetic_tags.length > 0) payload.aesthetic_tags = row.aesthetic_tags
  if (typeof row.seller_rating === 'number') payload.seller_rating = row.seller_rating
  return payload
}

/**
 * Build a `created`/`updated` ListingChange, or `null` when the listing has no usable
 * photos — recs requires ≥1, so the caller skips the sync (nothing to index yet).
 */
export function toListingChange(
  row: ListingRowForRecs,
  kind: 'created' | 'updated',
): Extract<ListingChange, { kind: 'created' | 'updated' }> | null {
  const photos = photoPaths(row.images)
  if (photos.length === 0) return null
  return { kind, listing_id: row.id, payload: toPayload(row), photo_paths: photos, primary_index: 0 }
}

/** A sold listing drops out of ranking — no payload/photos needed. */
export function listingSold(listingId: string): ListingChange {
  return { kind: 'sold', listing_id: listingId }
}

/** A deleted listing is removed from the index — no payload/photos needed. */
export function listingDeleted(listingId: string): ListingChange {
  return { kind: 'deleted', listing_id: listingId }
}
