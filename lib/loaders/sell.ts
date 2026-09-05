/**
 * Seller-side loaders — /sell (catalog) and /sell/new (wizard prefill + gates), shared with
 * GET /api/sell/catalog and GET /api/sell/new for the native apps.
 *
 * Open buyer offers and the payout for sold items are read with the service role (orders are
 * party-scoped under RLS; these are the seller's own listings). The ID-verification gate is the
 * page's exact rule: behind VERIFICATION_ENABLED, an unverified seller who is risk-flagged or
 * over the trailing-volume threshold must verify before listing.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents, FEE_TIERS, WELCOME_SALES } from '@/lib/fees'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { fmtRate } from '@/lib/tier-dashboard'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED, VERIFICATION_ENABLED } from '@/lib/flags'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'
import { normalizeMeasurements } from '@/lib/taxonomy'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type SellerListing = {
  id: string
  title: string
  brand: string
  size: string
  price_cents: number | null
  price_display: string
  status: string
  image: string | null
  photo_count: number
  created_at: string
  updated_at: string
  saves_count: number
  view_count: number
  boosted: boolean
  boosted_until: string | null
  bumped_at: string | null
  rejection_reason: string | null
  open_offers: number
  top_offer_display: string | null
  sold_at: string
  payout_display: string | null
  order_id: string | null
}

export type SellCatalog = {
  viewer: { username: string; display_name: string | null }
  listings: SellerListing[]
  fee_line: string
  seller_bps: number
  welcome_left: number
  sales_count: number
  flags: { bump: boolean; boost: boolean }
}

export async function loadSellCatalog(opts: { supabase: Client; user: User }): Promise<SellCatalog> {
  const { supabase, user } = opts
  const service = createServiceClientRaw()
  const [{ data: profile }, { data: rows }, sellerBps] = await Promise.all([
    supabase.from('profiles').select('username, display_name, lifetime_sales_count').eq('id', user.id).single(),
    supabase
      .from('listings')
      .select('id, title, brand, size, price_cents, status, images, possession_photo_url, created_at, updated_at, saves_count, view_count, boosted_until, bumped_at, rejection_reason, is_price_dropped')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    resolveEffectiveBps(service, user.id, 'seller'),
  ])

  const username: string = (profile?.username as string) ?? ''
  const salesCount: number = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeLeft = Math.max(0, WELCOME_SALES - salesCount)

  type Row = {
    id: string; title: string | null; brand: string | null; size: string | null; price_cents: number | null; status: string
    images: string[] | null; possession_photo_url: string | null; created_at: string; updated_at: string
    saves_count: number | null; view_count: number | null; boosted_until: string | null; bumped_at: string | null
    rejection_reason: string | null; is_price_dropped: boolean
  }
  const all = (rows ?? []) as Row[]
  const ids = all.map((r) => r.id)
  const soldIds = all.filter((r) => r.status === 'sold').map((r) => r.id)

  const offerCounts = new Map<string, { count: number; top: number }>()
  const payoutMap = new Map<string, { transfer_cents: number; released_at: string | null; order_id: string; created_at: string }>()
  if (ids.length > 0) {
    const [{ data: offers }, { data: orders }] = await Promise.all([
      supabase.from('offers').select('listing_id, amount_cents, from_user, state').in('listing_id', ids).eq('state', 'open').neq('from_user', user.id),
      soldIds.length > 0
        ? service.from('orders').select('id, listing_id, transfer_cents, released_at, created_at').in('listing_id', soldIds).eq('seller_id', user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    for (const o of (offers ?? []) as Array<{ listing_id: string; amount_cents: number }>) {
      const cur = offerCounts.get(o.listing_id) ?? { count: 0, top: 0 }
      offerCounts.set(o.listing_id, { count: cur.count + 1, top: Math.max(cur.top, o.amount_cents) })
    }
    for (const o of (orders ?? []) as Array<{ id: string; listing_id: string; transfer_cents: number; released_at: string | null; created_at: string }>) {
      if (!payoutMap.has(o.listing_id)) payoutMap.set(o.listing_id, { transfer_cents: o.transfer_cents, released_at: o.released_at, order_id: o.id, created_at: o.created_at })
    }
  }

  const now = Date.now()
  const listings: SellerListing[] = all.map((r) => {
    const images: string[] = Array.isArray(r.images) ? r.images.filter(Boolean) : []
    const photoCount = images.length + (r.possession_photo_url && !images.includes(r.possession_photo_url) ? 1 : 0)
    const payout = payoutMap.get(r.id)
    return {
      id: r.id,
      title: r.title ?? '',
      brand: r.brand ?? '',
      size: r.size ?? '',
      price_cents: r.price_cents ?? null,
      price_display: r.price_cents ? formatCents(r.price_cents) : '$ —',
      status: r.status,
      image: images[0] ?? null,
      photo_count: Math.min(6, photoCount),
      created_at: r.created_at,
      updated_at: r.updated_at,
      saves_count: r.saves_count ?? 0,
      view_count: r.view_count ?? 0,
      boosted: !!r.boosted_until && new Date(r.boosted_until).getTime() > now,
      boosted_until: r.boosted_until,
      bumped_at: r.bumped_at,
      rejection_reason: r.rejection_reason,
      open_offers: offerCounts.get(r.id)?.count ?? 0,
      top_offer_display: offerCounts.get(r.id) ? formatCents(offerCounts.get(r.id)!.top) : null,
      sold_at: payout?.released_at ?? payout?.created_at ?? r.updated_at,
      payout_display: payout ? formatCents(payout.transfer_cents) : null,
      order_id: payout?.order_id ?? null,
    }
  })

  const tierIdx = FEE_TIERS.findIndex((t) => t.bps === sellerBps)
  const tierNumber = tierIdx >= 0 ? FEE_TIERS.length - tierIdx : 1
  const feeLine = welcomeLeft > 0
    ? `WELCOME RAMP — 0% FEE · ${welcomeLeft} OF ${WELCOME_SALES} FREE SALES LEFT`
    : `TIER ${tierNumber} — ${fmtRate(sellerBps)} FEE`

  return {
    viewer: { username, display_name: (profile?.display_name as string | null) ?? null },
    listings,
    fee_line: feeLine,
    seller_bps: sellerBps,
    welcome_left: welcomeLeft,
    sales_count: salesCount,
    flags: { bump: BUMP_ENABLED, boost: BOOSTED_POSTS_ENABLED },
  }
}

export interface ListingInitial {
  id: string
  status: string
  title: string | null
  brand: string | null
  category: string | null
  department: string | null
  subcategory: string | null
  size: string | null
  color: string | null
  description: string | null
  condition_score: number | null
  price_cents: number | null
  images: string[]
  possession_photo_url: string | null
  measurements: Record<string, number>
}

export type SellNewGate = {
  /** True when the seller must complete ID verification before listing (→ /onboarding/verify?required=sell). */
  must_verify: boolean
  viewer: { username: string; display_name: string | null }
  seller_bps: number
  welcome_sales_remaining: number
  mode: 'new' | 'edit'
  /** Prefill for `?edit=` / `?draft=`; null for a fresh listing. */
  initial: ListingInitial | null
  /** True when an id was given but no usable row exists for this mode (page → redirect('/sell')). */
  row_missing: boolean
}

const UUID_RE = /^[0-9a-f-]{36}$/i

/** The seller ID-verification gate, exactly as /sell/new applies it. */
export async function sellerMustVerifyNow(userId: string): Promise<boolean> {
  if (!VERIFICATION_ENABLED) return false
  const svc = createServiceClientRaw()
  const { data: vp } = await svc.from('profiles').select('id_verification_status').eq('id', userId).single()
  const verified = (vp as { id_verification_status?: string } | null)?.id_verification_status === 'verified'
  return !verified && (await sellerMustVerify(svc, userId))
}

export async function loadSellNew(opts: { supabase: Client; user: User; draft?: string | null; edit?: string | null }): Promise<SellNewGate> {
  const { supabase, user } = opts
  const edit = opts.edit ?? undefined
  const draft = opts.draft ?? undefined

  const mustVerify = await sellerMustVerifyNow(user.id)

  const rowId = edit && UUID_RE.test(edit) ? edit : draft && UUID_RE.test(draft) ? draft : null
  const mode: 'new' | 'edit' = edit && UUID_RE.test(edit) ? 'edit' : 'new'

  const [{ data: profile }, sellerBps, { data: row }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, lifetime_sales_count').eq('id', user.id).single(),
    resolveEffectiveBps(createServiceClientRaw(), user.id, 'seller'),
    rowId
      ? supabase
        .from('listings')
        .select('id, seller_id, status, title, brand, category, department, subcategory, size, color, description, condition_score, price_cents, images, possession_photo_url, measurements')
        .eq('id', rowId)
        .eq('seller_id', user.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const username: string = (profile?.username as string) ?? ''
  const salesCount: number = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeSalesRemaining = Math.max(0, WELCOME_SALES - salesCount)

  let initial: ListingInitial | null = null
  let rowMissing = false
  if (row) {
    const okForMode = mode === 'edit' ? ['active', 'pending_review'].includes(row.status) : row.status === 'draft'
    if (!okForMode) rowMissing = true
    else {
      initial = {
        id: row.id,
        status: row.status,
        title: row.title ?? null,
        brand: row.brand ?? null,
        category: row.category ?? null,
        department: row.department ?? 'menswear',
        subcategory: row.subcategory ?? null,
        size: row.size ?? null,
        color: row.color ?? null,
        description: row.description ?? null,
        condition_score: row.condition_score ?? null,
        price_cents: row.price_cents ?? null,
        images: Array.isArray(row.images) ? row.images : [],
        possession_photo_url: row.possession_photo_url ?? null,
        measurements: normalizeMeasurements(row.measurements, row.category),
      }
    }
  } else if (rowId) {
    rowMissing = true
  }

  return {
    must_verify: mustVerify,
    viewer: { username, display_name: (profile?.display_name as string | null) ?? null },
    seller_bps: sellerBps,
    welcome_sales_remaining: welcomeSalesRemaining,
    mode,
    initial,
    row_missing: rowMissing,
  }
}
