/**
 * Saved-search alert dispatch (G8) — SERVER ONLY. When a listing goes ACTIVE, notify every
 * user whose saved search matches it (except the seller). Caller gates on
 * SAVED_SEARCH_ALERTS_ENABLED. Fail-soft: never throws (a missed alert must never fail the
 * approval). In-memory matching across all saved searches is fine at launch scale; move to a
 * DB-side match if saved_searches grows large (the cap is logged, not silent).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { selectAlertRecipients, type MatchableListing, type SavedSearchQuery } from '@/lib/search/match'
import { notify } from '@/lib/notify'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/** Safety cap on saved searches scanned per publish (logged when hit). */
export const MAX_SAVED_SEARCHES = 5000

export async function dispatchSavedSearchAlerts(
  service: ServiceClient,
  listingId: string,
  appUrl?: string,
): Promise<number> {
  try {
    const { data: l } = await service
      .from('listings')
      .select('id, seller_id, status, title, brand, category, department, size, condition_score, price_cents, is_price_dropped')
      .eq('id', listingId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = l as any
    if (!row || row.status !== 'active') return 0

    const { data: sellerProfile } = await service
      .from('profiles').select('id_verification_status').eq('id', row.seller_id).single()
    const sellerVerified =
      (sellerProfile as { id_verification_status?: string } | null)?.id_verification_status === 'verified'

    const listing: MatchableListing = {
      status: row.status,
      title: row.title ?? '',
      brand: row.brand ?? '',
      category: row.category ?? '',
      department: row.department ?? '',
      size: row.size ?? '',
      condition_score: row.condition_score ?? 0,
      price_cents: row.price_cents ?? 0,
      is_price_dropped: Boolean(row.is_price_dropped),
      seller_verified: sellerVerified,
    }

    const { data: searches } = await service
      .from('saved_searches')
      .select('user_id, query')
      .limit(MAX_SAVED_SEARCHES)
    const rows = (searches ?? []) as Array<{ user_id: string; query: SavedSearchQuery }>
    if (rows.length >= MAX_SAVED_SEARCHES) {
      console.warn(`[saved-search] hit the ${MAX_SAVED_SEARCHES} scan cap for listing ${listingId} — some alerts may be skipped`)
    }

    const recipients = selectAlertRecipients(listing, rows, row.seller_id)
    for (const uid of recipients) {
      await notify(service, uid, 'saved_search', {
        itemTitle: row.title ?? undefined,
        amountCents: typeof row.price_cents === 'number' ? row.price_cents : undefined,
        listingId,
        appUrl,
      })
    }
    return recipients.length
  } catch (err) {
    console.error(`[saved-search] dispatch failed for listing ${listingId}:`, err)
    return 0
  }
}
