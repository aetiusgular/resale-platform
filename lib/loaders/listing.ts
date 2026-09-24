/**
 * Listing detail loader — the data assembly behind /listings/[id] (4A), shared with
 * GET /api/listings/[id] so the native apps render the same placard from the same rules.
 *
 * Visibility is unchanged: active + sold listings are public; any other status is visible to the
 * seller and admins only (`null` → the page 404s, the route answers 404). The seller trust line
 * uses the service client because orders are only readable by their parties under RLS; nothing
 * user-specific leaks (counts only). `images` is the seller's ordered public photos (up to 15);
 * the possession proof is a separate URL the DTO exposes only to the seller/admin.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { publicImages } from '@/lib/listings/images'
import { cleanIntlShipping, regionsForOrigin, REGION_LABELS, type IntlShipping } from '@/lib/shipping-regions'
import { countryName } from '@/lib/countries'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED, AUTH_BADGE_ENABLED, FOLLOWS_ENABLED } from '@/lib/flags'
import { measurementLabelsFor, normalizeMeasurements } from '@/lib/taxonomy'
import { getSellerStats, sellerTrustLine } from '@/lib/sellers/stats'
import { formatTimeAgo } from '@/app/components/format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export const LISTING_DETAIL_SELECT = `
      id, title, brand, category, department, subcategory, size, color, description,
      condition_score, condition_notes, measurements,
      price_cents, shipping_cents, ships_from, intl_shipping, saves_count, view_count, is_price_dropped,
      images, possession_photo_url,
      status, rejection_reason, created_at, updated_at,
      seller_id, authentication_status,
      profiles:seller_id (username, role, id_verification_status)
    `

/** The raw row as the page's getListing() returns it. */
export type ListingRow = {
  id: string
  title: string
  brand: string
  category: string
  department: string
  subcategory: string | null
  size: string | null
  color: string | null
  description: string | null
  condition_score: number | null
  condition_notes: string | null
  measurements: unknown
  price_cents: number
  shipping_cents: number | null
  ships_from: string | null
  intl_shipping: IntlShipping | null
  saves_count: number | null
  view_count: number | null
  is_price_dropped: boolean
  images: string[] | null
  possession_photo_url: string | null
  status: string
  rejection_reason: string | null
  created_at: string
  updated_at: string | null
  seller_id: string
  authentication_status: string
  profiles: { username: string; role: string; id_verification_status?: string } | null
}

export async function fetchListingRow(supabase: Client, id: string): Promise<ListingRow | null> {
  const { data } = await supabase.from('listings').select(LISTING_DETAIL_SELECT).eq('id', id).single()
  return (data as unknown as ListingRow | null) ?? null
}

export type LcTally = { legit: number; flagged: number; autoAuth: string; verdict: string }

export type ListingDetail = {
  listing: {
    id: string
    title: string
    brand: string
    category: string
    department: string
    subcategory: string | null
    size: string | null
    color: string | null
    description: string | null
    condition_score: number | null
    condition_notes: string | null
    /** Normalised `{LABEL: inches}` for the listing's category. */
    measurements: Record<string, number>
    measurement_labels: string[]
    price_cents: number
    price_display: string
    original_price_cents: number | null
    /** US-domestic shipping (system-derived). Only meaningful when `us_domestic`. */
    shipping_cents: number
    /** International lanes (lib/shipping-regions). */
    shipping: {
      ships_from: string
      ships_from_name: string
      /** True when the seller is in the US (the automatic, prepaid-label lane exists). */
      us_domestic: boolean
      regions: Array<{ key: string; label: string; cents: number }>
    }
    saves_count: number
    view_count: number
    is_price_dropped: boolean
    /** The seller's ordered public photos (up to 15; the first is the cover). */
    images: string[]
    /** Possession proof — seller and admin only, otherwise null. */
    possession_photo_url: string | null
    status: string
    status_word: string
    /** Seller only: why a listing was removed. */
    rejection_reason: string | null
    created_at: string
    updated_at: string | null
    authentication_status: string
    /** Flag-gated badge (AUTH_BADGE_ENABLED && authenticated). */
    authenticated: boolean
    listed_line: string
    spec: string
    crumb: { parts: string[]; href: string }
  }
  seller: {
    id: string
    username: string
    initials: string
    role: string | null
    id_verification_status: string | null
    verified: boolean
    trust_line: string
  }
  viewer: {
    id: string | null
    username: string
    is_seller: boolean
    is_admin: boolean
    saved: boolean
    following: boolean
    can_buy: boolean
    /** Verified member, moderator or admin — enables the LC composer (post_comment RPC is the source of truth). */
    can_post: boolean
    can_edit: boolean
    /** This viewer already asked the seller to add measurements (PDP REQUESTED state). */
    measurement_requested: boolean
  }
  lc: LcTally
  flags: { bump: boolean; boost: boolean; follows: boolean; auth_badge: boolean }
}

export async function loadListingDetail(opts: {
  supabase: Client
  user: User | null
  id: string
  /** Pass the row when the caller already fetched it (page + metadata share one flight). */
  row?: ListingRow | null
}): Promise<ListingDetail | null> {
  const { supabase, user, id } = opts
  const listing = opts.row === undefined ? await fetchListingRow(supabase, id) : opts.row
  if (!listing) return null

  let isAdmin = false
  const isSeller = user?.id === listing.seller_id
  let userProfile: { role?: string; is_moderator?: boolean; id_verification_status?: string } | null = null
  let currentUsername = ''
  let isSaved = false
  let isFollowing = false
  let measurementRequested = false
  let originalPriceCents: number | null = null

  if (user) {
    const [profileResult, saveResult, priceResult, followResult, measReqResult] = await Promise.all([
      supabase.from('profiles').select('role, is_moderator, username, id_verification_status').eq('id', user.id).single(),
      supabase.from('saves').select('id').eq('user_id', user.id).eq('listing_id', id).maybeSingle(),
      listing.is_price_dropped
        ? supabase.from('price_history').select('old_price_cents').eq('listing_id', id).order('changed_at', { ascending: true }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      FOLLOWS_ENABLED && !isSeller
        ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', listing.seller_id).maybeSingle()
        : Promise.resolve({ data: null }),
      !isSeller
        ? supabase.from('measurement_requests').select('id').eq('requester_id', user.id).eq('listing_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    isAdmin = profileResult.data?.role === 'admin'
    userProfile = profileResult.data
    currentUsername = (profileResult.data?.username as string) ?? ''
    isSaved = !!saveResult.data
    isFollowing = !!followResult.data
    measurementRequested = !!measReqResult.data
    originalPriceCents = (priceResult.data as { old_price_cents?: number } | null)?.old_price_cents ?? null
  } else if (listing.is_price_dropped) {
    const { data: firstHistory } = await supabase
      .from('price_history').select('old_price_cents').eq('listing_id', id)
      .order('changed_at', { ascending: true }).limit(1).maybeSingle()
    originalPriceCents = (firstHistory as { old_price_cents?: number } | null)?.old_price_cents ?? null
  }

  const isActive = listing.status === 'active'
  const isSold = listing.status === 'sold'
  // Active + sold listings are public; anything else is seller/admin only.
  if (!isActive && !isSold && !isAdmin && !isSeller) return null

  // Seller trust line + LC tally (counts only; service client for orders).
  const service = createServiceClientRaw()
  const [statsMap, { data: voteRows }] = await Promise.all([
    getSellerStats(service, [listing.seller_id]),
    supabase.from('comments').select('vote, source, verdict').eq('listing_id', id).eq('thread_type', 'lc').eq('status', 'visible'),
  ])
  const votes = (voteRows ?? []) as Array<{ vote: string | null; source: string; verdict: string | null }>
  const auto = votes.find((c) => c.source === 'auto')
  const lc: LcTally = {
    legit: votes.filter((c) => c.vote === 'legit').length,
    flagged: votes.filter((c) => c.vote === 'flag').length,
    autoAuth: auto?.verdict === 'authentic' ? 'TAG PASS' : auto?.verdict === 'counterfeit' ? 'TAG FAIL' : auto ? 'UNCERTAIN' : 'PENDING',
    verdict: listing.authentication_status === 'authenticated' ? 'LEGIT' : listing.authentication_status === 'rejected' ? 'NOT LEGIT' : 'PENDING',
  }

  const allImages: string[] = publicImages(listing.images, listing.possession_photo_url)
  const seller = listing.profiles
  const sellerHandle = seller?.username ?? '—'
  const sellerInitials = sellerHandle.slice(0, 2).toUpperCase()
  const authenticated = AUTH_BADGE_ENABLED && listing.authentication_status === 'authenticated'
  const verifiedSeller = seller?.id_verification_status === 'verified'
  const shippingCents = listing.shipping_cents ?? floorShippingCents(listing.category)
  const canBuy = isActive && !isSeller
  const crumbParts = [listing.department, listing.category, listing.subcategory].filter(Boolean) as string[]
  const crumbSp = new URLSearchParams({ dept: listing.department, cat: listing.category })
  if (listing.subcategory) crumbSp.set('subcat', listing.subcategory)
  const statusWord = isSold ? 'SOLD' : listing.status === 'pending_escrow' ? 'PENDING' : listing.status === 'pending_review' ? 'IN REVIEW' : listing.status === 'removed' ? 'REMOVED' : listing.status === 'draft' ? 'DRAFT' : 'UNAVAILABLE'
  const listedLine = isSold
    ? `SOLD ${formatTimeAgo(listing.updated_at ?? listing.created_at)} · ${listing.saves_count ?? 0} SAVED`
    : `LISTED ${formatTimeAgo(listing.created_at)} · ${listing.saves_count ?? 0} SAVED`
  const measurements = normalizeMeasurements(listing.measurements, listing.category)
  const measLabels = measurementLabelsFor(listing.category, measurements)
  const spec = [listing.size?.toUpperCase(), listing.color?.toUpperCase()].filter(Boolean).join(' · ')
  const trustLine = sellerTrustLine(statsMap.get(listing.seller_id), verifiedSeller)
  // Any verified member can weigh in; moderators/admins always can. The
  // post_comment RPC is the source of truth — this only enables the input.
  const canPost = !!user && (
    userProfile?.is_moderator === true || userProfile?.role === 'admin' ||
    userProfile?.id_verification_status === 'verified'
  )
  const privileged = isSeller || isAdmin

  return {
    listing: {
      id: listing.id,
      title: listing.title,
      brand: listing.brand,
      category: listing.category,
      department: listing.department,
      subcategory: listing.subcategory ?? null,
      size: listing.size ?? null,
      color: listing.color ?? null,
      description: listing.description ?? null,
      condition_score: listing.condition_score ?? null,
      condition_notes: listing.condition_notes ?? null,
      measurements,
      measurement_labels: [...measLabels],
      price_cents: listing.price_cents,
      price_display: formatCents(listing.price_cents),
      original_price_cents: listing.is_price_dropped ? originalPriceCents : null,
      shipping_cents: shippingCents,
      shipping: shippingLanes(listing.ships_from, listing.intl_shipping),
      saves_count: listing.saves_count ?? 0,
      view_count: listing.view_count ?? 0,
      is_price_dropped: listing.is_price_dropped,
      images: allImages,
      possession_photo_url: privileged ? (listing.possession_photo_url ?? null) : null,
      status: listing.status,
      status_word: statusWord,
      rejection_reason: isSeller ? (listing.rejection_reason ?? null) : null,
      created_at: listing.created_at,
      updated_at: listing.updated_at ?? null,
      authentication_status: listing.authentication_status,
      authenticated,
      listed_line: listedLine,
      spec,
      crumb: { parts: crumbParts, href: `/browse?${crumbSp.toString()}` },
    },
    seller: {
      id: listing.seller_id,
      username: sellerHandle,
      initials: sellerInitials,
      role: seller?.role ?? null,
      id_verification_status: seller?.id_verification_status ?? null,
      verified: verifiedSeller,
      trust_line: trustLine,
    },
    viewer: {
      id: user?.id ?? null,
      username: currentUsername,
      is_seller: isSeller,
      is_admin: isAdmin,
      saved: isSaved,
      following: isFollowing,
      can_buy: canBuy,
      can_post: canPost && isActive,
      can_edit: isSeller && (isActive || listing.status === 'pending_review'),
      measurement_requested: measurementRequested,
    },
    lc,
    flags: { bump: BUMP_ENABLED, boost: BOOSTED_POSTS_ENABLED, follows: FOLLOWS_ENABLED, auth_badge: AUTH_BADGE_ENABLED },
  }
}

/** The lanes a listing ships on, for the listing page's shipping line. */
function shippingLanes(shipsFrom: string | null, intl: IntlShipping | null) {
  const origin = shipsFrom ?? 'US'
  const rates = cleanIntlShipping(intl ?? {}, origin)
  return {
    ships_from: origin,
    ships_from_name: countryName(origin),
    us_domestic: origin === 'US',
    regions: regionsForOrigin(origin).filter((k) => rates[k] !== undefined).map((k) => ({ key: k as string, label: REGION_LABELS[k], cents: rates[k] as number })),
  }
}
