/**
 * Listing lifecycle → recs-engine indexing (SERVER ONLY). When a platform listing
 * goes active / sold / removed, mirror the change to recs-engine's `POST /v1/listings`
 * webhook (via lib/recs/client), so the vector index tracks the live catalog.
 *
 * FAIL-SOFT everywhere: a sync miss must NEVER fail the platform's own listing
 * operation. Callers invoke these from Next's `after()` so they run post-response and
 * add zero latency. No-op when RECS_ENABLED is false (postListingChange also guards,
 * but we skip the DB read entirely when the integration is off).
 *
 * Column note: the recs payload only needs the fields in RECS_COLUMNS. `aesthetic_tags`
 * / `seller_rating` are optional in the mapper and intentionally NOT selected (no such
 * columns yet) — the mapper omits them when absent.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { RECS_ENABLED } from '@/lib/flags'
import { postListingChange } from './client'
import { toListingChange, listingSold, listingDeleted, type ListingRowForRecs } from './listing-map'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

const RECS_COLUMNS = 'id, brand, category, price_cents, size, condition_score, created_at, images'

/**
 * Index a listing as created/updated: read its current row, map to a ListingChange,
 * and post. Skips silently when the row is gone or has no usable photos (mapper → null).
 */
export async function recsIndexListing(
  service: ServiceClient,
  listingId: string,
  kind: 'created' | 'updated',
): Promise<void> {
  if (!RECS_ENABLED) return
  try {
    const { data } = await service
      .from('listings')
      .select(RECS_COLUMNS)
      .eq('id', listingId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any
    if (!row) return
    const change = toListingChange(row as ListingRowForRecs, kind)
    if (change) await postListingChange(change)
  } catch {
    /* fail-soft: indexing must never break the listing operation */
  }
}

/** Drop a sold listing from ranking (no payload needed). */
export async function recsMarkSold(listingId: string): Promise<void> {
  if (!RECS_ENABLED) return
  try {
    await postListingChange(listingSold(listingId))
  } catch {
    /* fail-soft */
  }
}

/** Remove a deleted/removed listing from the index (no payload needed). */
export async function recsMarkRemoved(listingId: string): Promise<void> {
  if (!RECS_ENABLED) return
  try {
    await postListingChange(listingDeleted(listingId))
  } catch {
    /* fail-soft */
  }
}
