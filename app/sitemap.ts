import type { MetadataRoute } from 'next'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { absUrl } from '@/lib/seo'

/**
 * Dynamic sitemap: active listings + their sellers + public statics.
 * Discovery backbone — /browse paginates via a "Load more" button, so crawlers
 * only ever see the first page of listing links in HTML; this file is how the
 * rest get found. Regenerates per request; fine at current scale. A single
 * file is good to 50k URLs — split into a sitemap index long before that.
 */

// Metadata routes do NOT inherit the root layout's force-dynamic — without
// this, `next build` prerenders the sitemap ONCE (route table shows ○ static)
// and the listing set freezes until the next deploy. Force per-request
// rendering so new and sold listings appear as crawlers fetch.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const service = createServiceClientRaw()

  const { data } = await service
    .from('listings')
    .select('id, updated_at, profiles:seller_id (username)')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(50000)

  // supabase-js types embedded joins as to-many; normalize object-or-array
  // (same shape-cast the listing page uses for its profiles join).
  type Row = {
    id: string
    updated_at: string | null
    profiles: { username?: string | null } | Array<{ username?: string | null }> | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const listingEntries: MetadataRoute.Sitemap = rows.map((l) => ({
    url: absUrl(`/listings/${l.id}`),
    ...(l.updated_at ? { lastModified: new Date(l.updated_at) } : {}),
  }))

  const usernames = new Set<string>()
  for (const l of rows) {
    const p = l.profiles
    const u = Array.isArray(p) ? p[0]?.username : p?.username
    if (u) usernames.add(u)
  }
  const sellerEntries: MetadataRoute.Sitemap = [...usernames].map((username) => ({
    url: absUrl(`/sellers/${encodeURIComponent(username)}`),
  }))

  const staticEntries: MetadataRoute.Sitemap = [
    '/browse',
    '/enter',
    '/fees',
    '/terms',
    '/privacy',
  ].map((p) => ({ url: absUrl(p) }))

  return [...staticEntries, ...listingEntries, ...sellerEntries]
}
