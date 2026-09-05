/**
 * Seller profile loader — /sellers/[username] and GET /api/sellers/[username].
 *
 * Seller profiles are public. Everything about the seller is read with the service client (as
 * the page always did): `orders` and `buyer_stats` are party/service-only under RLS and only
 * counts leave this function. Viewer-scoped bits (own profile, follow state, moderator
 * recommendation status) are guarded on `user`.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { formatCents } from '@/lib/fees'
import { aggregateRating } from '@/lib/reviews/rating'
import { FOLLOWS_ENABLED, REVIEWS_ENABLED } from '@/lib/flags'
import { publicImages } from '@/lib/listings/images'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type SellerCard = {
  id: string
  title: string
  brand: string
  category: string
  department: string
  size: string
  condition_score: number
  price_cents: number
  saves_count: number
  is_price_dropped: boolean
  images: string[]
  created_at: string
  seller: { username: string; id_verification_status: string }
  authentication_status: string
  original_price_cents: null
  price_display: string
}

export type SellerReview = { id: string; stars: number; body: string; created_at: string; reviewer_id: string; reviewer_username: string }

export type SellerProfile = {
  seller: {
    id: string
    username: string
    initials: string
    tier_label: string
    verified: boolean
    is_moderator: boolean
    is_checker: boolean
    checker_category: string | null
    member_year: number
    created_at: string
    total_sales: number
    dispute_rate: string
    purchase_count: number
    pays_fast: boolean
    rating: { average: number | null; count: number }
    /** The meta line parts exactly as the page renders them. */
    meta: string[]
  }
  listings: SellerCard[]
  reviews: SellerReview[]
  viewer: {
    id: string | null
    username: string
    is_own: boolean
    following: boolean
    is_moderator: boolean
    can_recommend_moderator: boolean
    moderator_rec_count: number
    viewer_recommended: boolean
  }
  flags: { follows: boolean; reviews: boolean }
}

export async function loadSellerProfile(opts: { supabase: Client; user: User | null; username: string }): Promise<SellerProfile | null> {
  const { supabase, user, username } = opts

  // Fetch current user's profile + target seller in parallel
  const service = createServiceClientRaw()
  const [{ data: currentProfile }, { data: seller }] = await Promise.all([
    user
      ? supabase.from('profiles').select('username, role, is_moderator').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    service.from('profiles').select('id, username, role, id_verification_status, tier, verified_checker, checker_category, is_moderator, created_at').eq('username', username).single(),
  ])
  const currentUsername: string = (currentProfile?.username as string) ?? ''

  if (!seller) return null

  // Fetch seller stats, buyer stats, and listings in parallel
  const [{ data: sellerOrders }, { data: buyerStats }, { data: listingsRaw }] = await Promise.all([
    service.from('orders').select('id, state').eq('seller_id', seller.id),
    service.from('buyer_stats').select('purchase_count, dispute_count, pays_fast').eq('user_id', seller.id).single(),
    service.from('listings').select('id, title, brand, category, department, price_cents, images, condition_score, size, is_price_dropped, saves_count, authentication_status, created_at').eq('seller_id', seller.id).eq('status', 'active').order('created_at', { ascending: false }).limit(48),
  ])

  const totalSales = ((sellerOrders ?? []) as Array<{ state: string }>).filter((o) => o.state === 'released').length
  const totalDisputes = ((sellerOrders ?? []) as Array<{ state: string }>).filter((o) => o.state === 'disputed').length
  const disputeRate = totalSales > 0 ? `${((totalDisputes / totalSales) * 100).toFixed(0)}%` : '0%'

  const listings = (listingsRaw ?? []) as Array<Record<string, unknown>>
  const memberYear = new Date(seller.created_at as string).getFullYear()
  const avatarInitials = (seller.username as string).slice(0, 2).toUpperCase()
  const tierLabel = ((seller.tier as string) ?? 'bronze').toUpperCase()
  const isVerified = seller.id_verification_status === 'verified'
  const isChecker = seller.verified_checker === true
  const checkerCategory = (seller.checker_category as string | null) ?? null
  const sellerIsModerator = seller.is_moderator === true
  const viewerIsModerator = currentProfile?.role === 'admin' || currentProfile?.is_moderator === true

  // ── G9: reviews (aggregate + list) and follow state, behind flags ─────────
  const reviewsRaw = REVIEWS_ENABLED
    ? (((await service
      .from('reviews')
      .select('id, stars, body, created_at, reviewer_id')
      .eq('subject_id', seller.id)
      .eq('direction', 'buyer_to_seller')
      .order('created_at', { ascending: false })
      .limit(50)).data ?? []) as Array<{ id: string; stars: number; body: string; created_at: string; reviewer_id: string }>)
    : []
  const rating = aggregateRating(reviewsRaw.map((r) => r.stars))
  const reviewerIds = [...new Set(reviewsRaw.map((r) => r.reviewer_id))]
  const { data: reviewerProfiles } = reviewerIds.length
    ? await service.from('profiles').select('id, username').in('id', reviewerIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const nameById = new Map(((reviewerProfiles ?? []) as Array<{ id: string; username: string }>).map((rp) => [rp.id, rp.username]))

  let isFollowing = false
  if (FOLLOWS_ENABLED && user) {
    const { data: myFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', seller.id)
      .maybeSingle()
    isFollowing = !!myFollow
  }

  // ── G10: moderator recommendation status (only when the viewer can recommend) ──
  const canRecommendModerator =
    seller.id !== user?.id && viewerIsModerator && !sellerIsModerator && isVerified
  let modRecCount = 0
  let viewerRecommended = false
  if (canRecommendModerator && user) {
    const { data: recs } = await service
      .from('moderator_recommendations')
      .select('recommender_id')
      .eq('nominee_id', seller.id)
    const recommenderIds = ((recs ?? []) as Array<{ recommender_id: string }>).map((r) => r.recommender_id)
    viewerRecommended = recommenderIds.includes(user.id)
    if (recommenderIds.length) {
      const { data: validMods } = await service
        .from('profiles')
        .select('id')
        .in('id', recommenderIds)
        .eq('is_moderator', true)
        .eq('banned', false)
      modRecCount = (validMods ?? []).length
    }
  }

  const cards: SellerCard[] = listings.map((l) => ({
    id: l.id as string,
    title: l.title as string,
    brand: (l.brand as string) ?? '',
    category: (l.category as string) ?? '',
    department: (l.department as string) ?? '',
    size: (l.size as string) ?? '',
    condition_score: l.condition_score as number,
    price_cents: l.price_cents as number,
    saves_count: (l.saves_count as number) ?? 0,
    is_price_dropped: !!l.is_price_dropped,
    images: publicImages(l.images),
    created_at: l.created_at as string,
    seller: { username: seller.username as string, id_verification_status: seller.id_verification_status as string },
    authentication_status: (l.authentication_status as string) ?? 'none',
    original_price_cents: null,
    price_display: formatCents(l.price_cents as number),
  }))
  const purchaseCount = (buyerStats?.purchase_count as number | undefined) ?? 0
  const paysFast = !!buyerStats?.pays_fast
  const meta: string[] = [
    isVerified ? 'VERIFIED ID' : '',
    sellerIsModerator ? 'MODERATOR' : '',
    isChecker && checkerCategory ? `VERIFIED CHECKER — ${checkerCategory.toUpperCase()}` : '',
    `MEMBER SINCE ${memberYear}`,
    `${totalSales} ${totalSales === 1 ? 'SALE' : 'SALES'}${totalSales > 0 ? ` · ${disputeRate} DISPUTES` : ''}`,
    `${purchaseCount} PURCHASES${paysFast ? ' · PAYS FAST' : ''}`,
    REVIEWS_ENABLED && rating.count > 0 ? `★ ${rating.average?.toFixed(1)} · ${rating.count} ${rating.count === 1 ? 'REVIEW' : 'REVIEWS'}` : '',
  ].filter(Boolean)

  return {
    seller: {
      id: seller.id as string,
      username: seller.username as string,
      initials: avatarInitials,
      tier_label: tierLabel,
      verified: isVerified,
      is_moderator: sellerIsModerator,
      is_checker: isChecker,
      checker_category: checkerCategory,
      member_year: memberYear,
      created_at: seller.created_at as string,
      total_sales: totalSales,
      dispute_rate: disputeRate,
      purchase_count: purchaseCount,
      pays_fast: paysFast,
      rating: { average: rating.average, count: rating.count },
      meta,
    },
    listings: cards,
    reviews: reviewsRaw.map((r) => ({ ...r, reviewer_username: nameById.get(r.reviewer_id) ?? 'user' })),
    viewer: {
      id: user?.id ?? null,
      username: currentUsername,
      is_own: seller.id === user?.id,
      following: isFollowing,
      is_moderator: viewerIsModerator,
      can_recommend_moderator: canRecommendModerator,
      moderator_rec_count: modRecCount,
      viewer_recommended: viewerRecommended,
    },
    flags: { follows: FOLLOWS_ENABLED, reviews: REVIEWS_ENABLED },
  }
}
