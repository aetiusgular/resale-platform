/**
 * /sellers/[username] — public seller profile.
 * Header, avatar initials, tier, VERIFIED ID microtag, member-since,
 * two-sided stats rows, LISTINGS tab (grid), REVIEWS tab (empty state).
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { SITE_NAME } from '@/lib/seo'
import JsonLd from '@/app/components/json-ld'
import { profilePageJsonLd } from '@/lib/seo-listing'
import { formatCents } from '@/lib/fees'
import { aggregateRating } from '@/lib/reviews/rating'
import { FOLLOWS_ENABLED, REVIEWS_ENABLED } from '@/lib/flags'
import FollowButton from './follow-button'
import RecommendModeratorButton from './recommend-moderator-button'
import AppShell from '@/app/components/app-shell'
import GuestAction from '@/app/components/guest-action'
import PrefetchLink from '@/app/components/prefetch-link'
import SellerListingsGrid from './seller-listings'

interface PageProps {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const title = `@${username}`
  const description = `@${username}'s closet on ${SITE_NAME} — secondhand fashion listings.`
  const path = `/sellers/${username}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  }
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}H AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D AGO`
  return `${Math.floor(days / 7)}W AGO`
}

export default async function SellerProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params
  const { tab = 'listings' } = await searchParams

  const supabase = await createClient()
  // Seller profiles are public — guests (user === null) view freely. Everything
  // user-scoped (own profile, follow state, moderator recommend) is guarded on `user`.
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch current user's profile + target seller in parallel
  const service = createServiceClientRaw()
  const [{ data: currentProfile }, { data: seller }] = await Promise.all([
    user
      ? supabase.from('profiles').select('username, role, is_moderator').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    service.from('profiles').select('id, username, role, id_verification_status, tier, verified_checker, checker_category, is_moderator, created_at').eq('username', username).single(),
  ])
  const currentUsername: string = (currentProfile?.username as string) ?? ''

  if (!seller) notFound()

  // Fetch seller stats, buyer stats, and listings in parallel
  const [{ data: sellerOrders }, { data: buyerStats }, { data: listingsRaw }] = await Promise.all([
    service.from('orders').select('id, state').eq('seller_id', seller.id),
    service.from('buyer_stats').select('purchase_count, dispute_count, pays_fast').eq('user_id', seller.id).single(),
    service.from('listings').select('id, title, brand, category, department, price_cents, images, condition_score, size, is_price_dropped, saves_count, authentication_status, created_at').eq('seller_id', seller.id).eq('status', 'active').order('created_at', { ascending: false }).limit(48),
  ])

  const totalSales = (sellerOrders ?? []).filter(o => o.state === 'released').length
  const totalDisputes = (sellerOrders ?? []).filter(o => o.state === 'disputed').length
  const disputeRate = totalSales > 0 ? `${((totalDisputes / totalSales) * 100).toFixed(0)}%` : '0%'

  const listings = listingsRaw ?? []
  const memberYear = new Date(seller.created_at as string).getFullYear()
  const avatarInitials = (seller.username as string).slice(0, 2).toUpperCase()
  const tierLabel = ((seller.tier as string) ?? 'bronze').toUpperCase()
  const isVerified = seller.id_verification_status === 'verified'
  const isChecker = seller.verified_checker === true
  const checkerCategory = seller.checker_category as string | null
  const sellerIsModerator = seller.is_moderator === true
  const viewerIsModerator = currentProfile?.role === 'admin' || currentProfile?.is_moderator === true

  // ── G9: reviews (aggregate + list) and follow state, behind flags ─────────
  const reviewsRaw = REVIEWS_ENABLED
    ? ((await service
        .from('reviews')
        .select('id, stars, body, created_at, reviewer_id')
        .eq('subject_id', seller.id)
        .eq('direction', 'buyer_to_seller')
        .order('created_at', { ascending: false })
        .limit(50)).data ?? [])
    : []
  const rating = aggregateRating((reviewsRaw as Array<{ stars: number }>).map((r) => r.stars))
  const reviewerIds = [...new Set((reviewsRaw as Array<{ reviewer_id: string }>).map((r) => r.reviewer_id))]
  const { data: reviewerProfiles } = reviewerIds.length
    ? await service.from('profiles').select('id, username').in('id', reviewerIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const nameById = new Map((reviewerProfiles ?? []).map((rp) => [rp.id as string, rp.username as string]))

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
    const recommenderIds = (recs ?? []).map((r) => r.recommender_id as string)
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

  const activeTab = tab === 'reviews' ? 'reviews' : 'listings'
  const isOwn = seller.id === user?.id
  const cards = listings.map((l) => ({
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
    images: Array.isArray(l.images) ? (l.images as string[]) : [],
    created_at: l.created_at as string,
    seller: { username: seller.username as string, id_verification_status: seller.id_verification_status as string },
    authentication_status: (l.authentication_status as string) ?? 'none',
    original_price_cents: null,
    price_display: formatCents(l.price_cents as number),
  }))
  const meta: string[] = [
    isVerified ? 'VERIFIED ID' : '',
    sellerIsModerator ? 'MODERATOR' : '',
    isChecker && checkerCategory ? `VERIFIED CHECKER — ${(checkerCategory as string).toUpperCase()}` : '',
    `MEMBER SINCE ${memberYear}`,
    `${totalSales} ${totalSales === 1 ? 'SALE' : 'SALES'}${totalSales > 0 ? ` · ${disputeRate} DISPUTES` : ''}`,
    `${buyerStats?.purchase_count ?? 0} PURCHASES${buyerStats?.pays_fast ? ' · PAYS FAST' : ''}`,
    REVIEWS_ENABLED && rating.count > 0 ? `★ ${rating.average?.toFixed(1)} · ${rating.count} ${rating.count === 1 ? 'REVIEW' : 'REVIEWS'}` : '',
  ].filter(Boolean)

  return (
    <AppShell username={currentUsername}>
      <JsonLd data={profilePageJsonLd(seller.username as string)} />
      <main className="saved-main">
        <div className="seller-head">
          <span className="seller-head__init">{avatarInitials}</span>
          <div className="grow">
            <div className="row row--wrap" style={{ gap: 12 }}>
              <h1 className="seller-head__name">@{seller.username}</h1>
              <span className="tag">{tierLabel}</span>
              {isVerified && <span className="tag tag--ink">VERIFIED</span>}
            </div>
            <div className="seller-head__meta">
              {meta.map((m, i) => <span key={i}>{i > 0 ? '· ' : ''}{m}</span>)}
            </div>
          </div>
          {!isOwn ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {user ? (
                <Link href={`/messages?seller=${seller.id}`} className="btn-ghost btn-ghost--inline">MESSAGE</Link>
              ) : (
                <GuestAction next={`/messages?seller=${seller.id}`} testId="seller-message-guest" className="btn-ghost btn-ghost--inline">MESSAGE</GuestAction>
              )}
              {FOLLOWS_ENABLED && (user
                ? <FollowButton sellerId={seller.id as string} initialFollowing={isFollowing} />
                : <GuestAction next={`/sellers/${username}`} testId="seller-follow-guest" className="btn-follow">FOLLOW</GuestAction>)}
              {canRecommendModerator && (
                <RecommendModeratorButton
                  nomineeId={seller.id as string}
                  initialCount={modRecCount}
                  initialRecommended={viewerRecommended}
                  threshold={3}
                />
              )}
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <PrefetchLink href="/settings" className="btn-ghost btn-ghost--inline">EDIT PROFILE</PrefetchLink>
              <PrefetchLink href="/sell" className="btn-follow">MANAGE LISTINGS</PrefetchLink>
            </div>
          )}
        </div>

        <div className="tabs-line" role="tablist">
          <PrefetchLink role="tab" aria-selected={activeTab === 'listings'} className={`tab-mono${activeTab === 'listings' ? ' is-active' : ''}`} href={`/sellers/${username}`}>LISTINGS ({listings.length})</PrefetchLink>
          <PrefetchLink role="tab" aria-selected={activeTab === 'reviews'} className={`tab-mono${activeTab === 'reviews' ? ' is-active' : ''}`} href={`/sellers/${username}?tab=reviews`}>REVIEWS{REVIEWS_ENABLED ? ` (${reviewsRaw.length})` : ''}</PrefetchLink>
          <span className="spacer" />
          {activeTab === 'listings' && <span className="link-underline tabs-line__sort" style={{ textDecoration: 'none' }}>SORT: NEWEST</span>}
        </div>

        {activeTab === 'listings' ? (
          cards.length === 0 ? (
            <div className="empty">
              <div className="empty__title">No active listings.</div>
              <div className="empty__sub">{isOwn ? 'LIST SOMETHING — IT GOES LIVE AFTER A QUICK REVIEW' : 'CHECK BACK, OR FOLLOW TO HEAR ABOUT NEW DROPS'}</div>
              {isOwn && <div className="empty__cta"><PrefetchLink href="/sell/new" className="btn-ghost btn-ghost--inline">NEW LISTING →</PrefetchLink></div>}
            </div>
          ) : (
            <SellerListingsGrid listings={cards} isGuest={!user} own={isOwn} />
          )
        ) : (
          <div className="rows-wrap">
            {reviewsRaw.length === 0 ? (
              <div className="empty">
                <div className="empty__title">No reviews yet.</div>
                <div className="empty__sub">REVIEWS ARE WRITTEN AFTER COMPLETED ORDERS</div>
              </div>
            ) : (
              (reviewsRaw as Array<{ id: string; stars: number; body: string; created_at: string; reviewer_id: string }>).map((r) => (
                <div key={r.id} className="lc-comment" style={{ maxWidth: 640, borderBottom: '1px solid var(--line-row)', paddingTop: 14 }}>
                  <span className="seller-init seller-init--sm">{(nameById.get(r.reviewer_id) ?? 'u').slice(0, 2).toUpperCase()}</span>
                  <div className="lc-comment__body">
                    <div className="lc-comment__who">
                      @{(nameById.get(r.reviewer_id) ?? 'user').toUpperCase()}
                      <span className="tag tag--ink" aria-label={`${r.stars} out of 5`}>{r.stars} / 5</span>
                      <span className="lc-comment__meta" style={{ marginTop: 0 }}>{formatTimeAgo(r.created_at)}</span>
                    </div>
                    {r.body && <p className="lc-comment__text">{r.body}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </AppShell>
  )
}
