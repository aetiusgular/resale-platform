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
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import GuestAction from '@/app/components/guest-action'

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
    service.from('listings').select('id, title, price_cents, images, condition_score, size, is_price_dropped, created_at').eq('seller_id', seller.id).eq('status', 'active').order('created_at', { ascending: false }).limit(48),
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

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeader username={currentUsername} />

      <JsonLd data={profilePageJsonLd(seller.username as string)} />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 80px 96px' }} className="seller-profile-inner">

        {/* Profile header */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{
            flex: 'none', width: '64px', height: '64px', borderRadius: '50%',
            border: '1px solid var(--color-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--color-ink-soft)',
          }}>
            {avatarInitials}
          </div>

          {/* Info */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '20px', color: 'var(--color-ink)' }}>
                @{seller.username}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px',
                border: '1px solid var(--color-ink)', borderRadius: '2px',
                fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--color-ink)',
              }}>
                {tierLabel}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {isVerified && (
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
                  VERIFIED ID
                </span>
              )}
              {sellerIsModerator && (
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
                  MODERATOR
                </span>
              )}
              {isChecker && checkerCategory && (
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
                  VERIFIED CHECKER — {(checkerCategory as string).toUpperCase()}
                </span>
              )}
              <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
                MEMBER SINCE {memberYear}
              </span>
            </div>

            {/* Two-sided stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
                AS SELLER · {totalSales} SALES{totalSales > 0 ? ` · ${disputeRate} DISPUTES` : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
                AS BUYER · {buyerStats?.purchase_count ?? 0} PURCHASES
                {buyerStats?.pays_fast ? ' · PAYS FAST' : ''}
              </span>
              {REVIEWS_ENABLED && rating.count > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
                  RATING · ★ {rating.average?.toFixed(1)} · {rating.count} REVIEW{rating.count === 1 ? '' : 'S'}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons. Guests see Message (→ popup); Follow/Recommend are authed-only. */}
          {seller.id !== user?.id && (
            <div style={{ marginLeft: 'auto', flex: 'none', display: 'flex', gap: '8px' }}>
              {user ? (
                <Link
                  href={`/messages?seller=${seller.id}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    height: '44px', padding: '0 24px',
                    background: 'var(--color-bg)', color: 'var(--color-ink)',
                    border: '1px solid var(--color-ink)', borderRadius: '2px',
                    font: '500 14px var(--font-ui)', textDecoration: 'none',
                  }}
                >
                  Message
                </Link>
              ) : (
                <GuestAction
                  next={`/messages?seller=${seller.id}`}
                  testId="seller-message-guest"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    height: '44px', padding: '0 24px',
                    background: 'var(--color-bg)', color: 'var(--color-ink)',
                    border: '1px solid var(--color-ink)', borderRadius: '2px',
                    font: '500 14px var(--font-ui)',
                  }}
                >
                  Message
                </GuestAction>
              )}
              {user && FOLLOWS_ENABLED && (
                <FollowButton sellerId={seller.id as string} initialFollowing={isFollowing} />
              )}
              {canRecommendModerator && (
                <RecommendModeratorButton
                  nomineeId={seller.id as string}
                  initialCount={modRecCount}
                  initialRecommended={viewerRecommended}
                  threshold={3}
                />
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ marginTop: '64px', display: 'flex', gap: '32px', borderBottom: '1px solid var(--color-line)' }}>
          {(['listings', 'reviews'] as const).map(t => (
            <Link
              key={t}
              href={`/sellers/${username}?tab=${t}`}
              style={{
                position: 'relative', paddingBottom: '12px', paddingTop: '12px',
                font: '500 12px var(--font-ui)', letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
                color: activeTab === t ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center',
              }}
            >
              {t === 'listings' ? `Listings (${listings.length})` : 'Reviews'}
              {activeTab === t && (
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '1px', background: 'var(--color-ink)' }} />
              )}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'listings' ? (
          <>
            {/* Sort */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                Sort: Newest <span style={{ color: 'var(--color-ink-soft)', fontSize: '10px' }}>▾</span>
              </span>
            </div>

            {listings.length === 0 ? (
              <p style={{ marginTop: '48px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--color-ink)' }}>
                No active listings.
              </p>
            ) : (
              <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px 24px' }}
                className="seller-listings-grid"
                data-testid="seller-listings-grid"
              >
                {listings.map(l => {
                  const images: string[] = Array.isArray(l.images) ? l.images : []
                  const frontImage = images[0] ?? null
                  return (
                    <Link key={l.id} href={`/listings/${l.id}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        aspectRatio: '3/4', boxSizing: 'border-box',
                        border: '1px solid var(--color-line)', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-line)',
                      }}>
                        {frontImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={frontImage} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>3 : 4</span>
                        )}
                      </div>
                      <div style={{ marginTop: '12px', minHeight: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
                        {formatTimeAgo(l.created_at)}
                      </div>
                      <div style={{ marginTop: '4px', minHeight: '20px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', lineHeight: 1.4, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(l.title as string).toUpperCase()}
                      </div>
                      <div style={{ marginTop: '4px', minHeight: '20px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
                        {formatCents(l.price_cents as number)}
                      </div>
                      <div style={{ marginTop: '4px', minHeight: '18px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                        {l.size} · {l.condition_score}/10
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* Reviews tab — real reviews (G9) or empty state */
          <div style={{ marginTop: '48px' }}>
            {reviewsRaw.length === 0 ? (
              <>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.35rem', lineHeight: 1.35, color: 'var(--color-ink)' }}>
                  No reviews yet.
                </p>
                <p style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                  Reviews are written after completed orders.
                </p>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
                {(reviewsRaw as Array<{ id: string; stars: number; body: string; created_at: string; reviewer_id: string }>).map((r) => (
                  <div key={r.id} style={{ border: '1px solid var(--color-line)', borderRadius: '2px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--color-accent)', fontSize: '14px', letterSpacing: '2px' }} aria-label={`${r.stars} out of 5 stars`}>
                        {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink)' }}>
                        @{nameById.get(r.reviewer_id) ?? 'user'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>
                        {formatTimeAgo(r.created_at)}
                      </span>
                    </div>
                    {r.body && (
                      <p style={{ marginTop: '8px', fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.5, color: 'var(--color-ink)' }}>
                        {r.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <MobileTabBar username={currentUsername} />
    </div>
  )
}
