/**
 * /sellers/[username] — public seller profile.
 * Header, avatar initials, tier, VERIFIED ID microtag, member-since,
 * two-sided stats rows, LISTINGS tab (grid), REVIEWS tab (empty state).
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SITE_NAME } from '@/lib/seo'
import JsonLd from '@/app/components/json-ld'
import { profilePageJsonLd } from '@/lib/seo-listing'
import { FOLLOWS_ENABLED, REVIEWS_ENABLED } from '@/lib/flags'
import { loadSellerProfile } from '@/lib/loaders/seller'
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

  // ONE data assembly shared with GET /api/sellers/[username] (native clients).
  const d = await loadSellerProfile({ supabase, user, username })
  if (!d) notFound()

  const { seller } = d
  const currentUsername = d.viewer.username
  const listings = d.listings
  const reviewsRaw = d.reviews
  const avatarInitials = seller.initials
  const tierLabel = seller.tier_label
  const isVerified = seller.verified
  const isFollowing = d.viewer.following
  const canRecommendModerator = d.viewer.can_recommend_moderator
  const modRecCount = d.viewer.moderator_rec_count
  const viewerRecommended = d.viewer.viewer_recommended
  const activeTab = tab === 'reviews' ? 'reviews' : 'listings'
  const isOwn = d.viewer.is_own
  const cards = d.listings
  const meta = seller.meta

  return (
    <AppShell username={currentUsername}>
      <JsonLd data={profilePageJsonLd(seller.username)} />
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
                ? <FollowButton sellerId={seller.id} initialFollowing={isFollowing} />
                : <GuestAction next={`/sellers/${username}`} testId="seller-follow-guest" className="btn-follow">FOLLOW</GuestAction>)}
              {canRecommendModerator && (
                <RecommendModeratorButton
                  nomineeId={seller.id}
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
              reviewsRaw.map((r) => (
                <div key={r.id} className="lc-comment" style={{ maxWidth: 640, borderBottom: '1px solid var(--line-row)', paddingTop: 14 }}>
                  <span className="seller-init seller-init--sm">{r.reviewer_username.slice(0, 2).toUpperCase()}</span>
                  <div className="lc-comment__body">
                    <div className="lc-comment__who">
                      @{r.reviewer_username.toUpperCase()}
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
