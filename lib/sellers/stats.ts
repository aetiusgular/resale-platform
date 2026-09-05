/**
 * Seller trust line shared by the listing page ("4.9 · 132 SALES · VERIFIED ID"),
 * the messages thread bar ("4.8 RATING · 61 SALES") and Saved → Sellers
 * ("34 LISTINGS · 4.9 RATING"). SERVER ONLY — takes the service client because
 * orders are only readable by their own parties under RLS; nothing user-specific
 * leaks (counts only).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { aggregateRating } from '@/lib/reviews/rating'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export type SellerStats = {
  /** Orders released to the seller (completed sales). */
  sales: number
  /** Mean buyer→seller stars (1 decimal) or null with no reviews. */
  rating: number | null
  ratingCount: number
  /** Active listings right now. */
  listings: number
}

export async function getSellerStats(service: ServiceClient, sellerIds: string[]): Promise<Map<string, SellerStats>> {
  const out = new Map<string, SellerStats>()
  const ids = Array.from(new Set(sellerIds.filter(Boolean)))
  for (const id of ids) out.set(id, { sales: 0, rating: null, ratingCount: 0, listings: 0 })
  if (ids.length === 0) return out

  const [{ data: orders }, { data: reviews }, { data: listings }] = await Promise.all([
    service.from('orders').select('seller_id').in('seller_id', ids).eq('state', 'released'),
    service.from('reviews').select('subject_id, stars').in('subject_id', ids).eq('direction', 'buyer_to_seller'),
    service.from('listings').select('seller_id').in('seller_id', ids).eq('status', 'active'),
  ])

  for (const o of (orders ?? []) as Array<{ seller_id: string }>) {
    const s = out.get(o.seller_id); if (s) s.sales++
  }
  for (const l of (listings ?? []) as Array<{ seller_id: string }>) {
    const s = out.get(l.seller_id); if (s) s.listings++
  }
  const starsBy = new Map<string, number[]>()
  for (const r of (reviews ?? []) as Array<{ subject_id: string; stars: number }>) {
    starsBy.set(r.subject_id, [...(starsBy.get(r.subject_id) ?? []), r.stars])
  }
  for (const [id, stars] of starsBy) {
    const agg = aggregateRating(stars)
    const s = out.get(id)
    if (s) { s.rating = agg.average; s.ratingCount = agg.count }
  }
  return out
}

/** "4.9 · 132 SALES · VERIFIED ID" (listing page 4A). */
export function sellerTrustLine(stats: SellerStats | undefined, verified: boolean): string {
  const parts: string[] = []
  if (stats?.rating != null) parts.push(stats.rating.toFixed(1))
  parts.push(`${stats?.sales ?? 0} SALES`)
  if (verified) parts.push('VERIFIED ID')
  return parts.join(' · ')
}

/** "4.8 RATING · 61 SALES" (messages thread bar). */
export function sellerRatingLine(stats: SellerStats | undefined): string {
  const parts: string[] = []
  if (stats?.rating != null) parts.push(`${stats.rating.toFixed(1)} RATING`)
  parts.push(`${stats?.sales ?? 0} SALES`)
  return parts.join(' · ')
}
