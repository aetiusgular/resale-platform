import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { getListing } from './get-listing'
import { formatCents } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED, AUTH_BADGE_ENABLED, FOLLOWS_ENABLED } from '@/lib/flags'
import { measurementLabelsFor, normalizeMeasurements } from '@/lib/taxonomy'
import { getSellerStats, sellerTrustLine } from '@/lib/sellers/stats'
import SaveButton from './save-button'
import MessageSellerButton from './message-seller-button'
import BumpButton from './bump-button'
import CommunitySection from './community-section'
import ListingGallery from './listing-gallery'
import MeasurementsPanel from './measurements-panel'
import ViewPing from './view-ping'
import FollowButton from '@/app/sellers/[username]/follow-button'
import AppShell from '@/app/components/app-shell'
import GuestAction from '@/app/components/guest-action'
import PrefetchLink from '@/app/components/prefetch-link'
import JsonLd from '@/app/components/json-ld'
import { formatTimeAgo } from '@/app/components/format'
import { breadcrumbJsonLd, metaDescription, productJsonLd, schemaImages } from '@/lib/seo-listing'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const data = await getListing(id)

  // Same behavior as the old status='active' filter for public viewers; the
  // seller/admin (who can fetch non-active rows) just gets the real title.
  if (!data) return { title: 'Listing not found' }

  const title = `${data.title} — ${data.brand} — ${formatCents(data.price_cents)}`
  const description = metaDescription(data)
  // Slots 0–4 only — index 5 is the POSSESSION proof photo, never public.
  const images = schemaImages(data.images)
  const ogImage = images[0] ?? null
  const path = `/listings/${id}`

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch user + listing in parallel (both independent). getListing is
  // cache()-shared with generateMetadata — this resolves from the same flight.
  const [{ data: { user } }, listing] = await Promise.all([
    supabase.auth.getUser(),
    getListing(id),
  ])

  if (!listing) notFound()

  let isAdmin = false
  const isSeller = user?.id === listing.seller_id
  let userProfile: { role?: string; is_moderator?: boolean; id_verification_status?: string } | null = null
  let currentUsername = ''
  let isSaved = false
  let isFollowing = false
  let originalPriceCents: number | null = null

  if (user) {
    const [profileResult, saveResult, priceResult, followResult] = await Promise.all([
      supabase.from('profiles').select('role, is_moderator, username, id_verification_status').eq('id', user.id).single(),
      supabase.from('saves').select('id').eq('user_id', user.id).eq('listing_id', id).maybeSingle(),
      listing.is_price_dropped
        ? supabase.from('price_history').select('old_price_cents').eq('listing_id', id).order('changed_at', { ascending: true }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      FOLLOWS_ENABLED && !isSeller
        ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', listing.seller_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    isAdmin = profileResult.data?.role === 'admin'
    userProfile = profileResult.data
    currentUsername = (profileResult.data?.username as string) ?? ''
    isSaved = !!saveResult.data
    isFollowing = !!followResult.data
    originalPriceCents = priceResult.data?.old_price_cents ?? null
  } else if (listing.is_price_dropped) {
    const { data: firstHistory } = await supabase
      .from('price_history').select('old_price_cents').eq('listing_id', id)
      .order('changed_at', { ascending: true }).limit(1).maybeSingle()
    originalPriceCents = firstHistory?.old_price_cents ?? null
  }

  const isActive = listing.status === 'active'
  const isSold = listing.status === 'sold'
  // Active + sold listings are public; anything else is seller/admin only.
  if (!isActive && !isSold && !isAdmin && !isSeller) {
    notFound()
  }

  // Seller trust line + LC tally (counts only; service client for orders).
  const service = createServiceClientRaw()
  const [statsMap, { data: voteRows }] = await Promise.all([
    getSellerStats(service, [listing.seller_id]),
    supabase.from('comments').select('vote, source, verdict').eq('listing_id', id).eq('thread_type', 'lc').eq('status', 'visible'),
  ])
  const votes = (voteRows ?? []) as Array<{ vote: string | null; source: string; verdict: string | null }>
  const auto = votes.find((c) => c.source === 'auto')
  const initialTally = {
    legit: votes.filter((c) => c.vote === 'legit').length,
    flagged: votes.filter((c) => c.vote === 'flag').length,
    autoAuth: auto?.verdict === 'authentic' ? 'TAG PASS' : auto?.verdict === 'counterfeit' ? 'TAG FAIL' : auto ? 'UNCERTAIN' : 'PENDING',
    verdict: listing.authentication_status === 'authenticated' ? 'LEGIT' : listing.authentication_status === 'rejected' ? 'NOT LEGIT' : 'PENDING',
  }

  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null
  const sellerHandle = seller?.username ?? '—'
  const sellerInitials = sellerHandle.slice(0, 2).toUpperCase()
  const authenticated = AUTH_BADGE_ENABLED && listing.authentication_status === 'authenticated'
  const verifiedSeller = seller?.id_verification_status === 'verified'
  const shippingCents = listing.shipping_cents ?? floorShippingCents(listing.category)
  const canBuy = isActive && !isSeller
  const crumbParts = [listing.department, listing.category, listing.subcategory].filter(Boolean) as string[]
  const crumbSp = new URLSearchParams({ dept: listing.department, cat: listing.category })
  if (listing.subcategory) crumbSp.set('subcat', listing.subcategory)
  const crumbHref = `/browse?${crumbSp.toString()}`
  const statusWord = isSold ? 'SOLD' : listing.status === 'pending_escrow' ? 'PENDING' : listing.status === 'pending_review' ? 'IN REVIEW' : listing.status === 'removed' ? 'REMOVED' : listing.status === 'draft' ? 'DRAFT' : 'UNAVAILABLE'
  const listedLine = isSold
    ? `SOLD ${formatTimeAgo(listing.updated_at ?? listing.created_at)} · ${listing.saves_count ?? 0} SAVED`
    : `LISTED ${formatTimeAgo(listing.created_at)} · ${listing.saves_count ?? 0} SAVED`
  const measurements = normalizeMeasurements(listing.measurements, listing.category)
  const measLabels = measurementLabelsFor(listing.category)
  const spec = [listing.size?.toUpperCase(), listing.color?.toUpperCase()].filter(Boolean).join(' · ')
  const trustLine = sellerTrustLine(statsMap.get(listing.seller_id), verifiedSeller)
  // Any verified member can weigh in; moderators/admins always can. The
  // post_comment RPC is the source of truth — this only enables the input.
  const canPost = !!user && (
    userProfile?.is_moderator === true || userProfile?.role === 'admin' ||
    userProfile?.id_verification_status === 'verified'
  )

  return (
    <AppShell username={currentUsername}>
      {/* Merchant-listing structured data — public (active) listings only. */}
      {isActive && (
        <>
          <JsonLd
            data={productJsonLd({
              id: listing.id,
              title: listing.title,
              brand: listing.brand,
              category: listing.category,
              department: listing.department,
              size: listing.size,
              description: listing.description,
              condition_score: listing.condition_score,
              price_cents: listing.price_cents,
              shipping_cents: listing.shipping_cents ?? null,
              images: listing.images,
              sellerUsername: seller?.username ?? null,
            })}
          />
          <JsonLd data={breadcrumbJsonLd(listing)} />
        </>
      )}
      {(isActive || isSold) && !isSeller && <ViewPing listingId={id} />}

      {/* Seller / admin status strips */}
      {isSeller && listing.status === 'pending_review' && (
        <div className="status-strip">IN REVIEW — YOUR LISTING IS IN THE QUEUE. IT GOES LIVE ONCE A MODERATOR APPROVES IT.</div>
      )}
      {isSeller && listing.status === 'draft' && (
        <div className="status-strip">
          DRAFT — NOT PUBLISHED YET.
          <PrefetchLink href={`/sell?draft=${id}`} className="link-underline link-underline--ink" style={{ marginLeft: 16 }}>CONTINUE IN SELL →</PrefetchLink>
        </div>
      )}
      {isSeller && listing.status === 'removed' && listing.rejection_reason && (
        <div className="status-strip status-strip--alert">LISTING REJECTED — {listing.rejection_reason}</div>
      )}
      {isAdmin && !isActive && !isSold && (
        <div className="status-strip">
          ADMIN VIEW · STATUS: {listing.status.toUpperCase()}
          <Link href="/admin/queue" className="link-underline link-underline--ink" style={{ marginLeft: 16 }}>← QUEUE</Link>
        </div>
      )}

      <div className="pdp-page">
        <div className="pdp">
          {/* LEFT: gallery + measurements (4A). ≤720px both columns unwrap into one
              stack ordered like the mobile-web 05 mock (globals.css `.pdp` rules). */}
          <div className="pdp__left">
            <PrefetchLink className="pdp__crumb" href={crumbHref}>
              <span className="pdp__crumb-full">← SEARCH · {crumbParts.map((p) => p.toUpperCase()).join(' / ')}</span>
              <span className="pdp__crumb-short">← BACK TO RESULTS</span>
            </PrefetchLink>
            <ListingGallery
              images={images}
              title={listing.title}
              showPossession={isSeller || isAdmin}
              saveSlot={!isSeller && (
                user
                  ? <SaveButton listingId={id} initialSaved={isSaved} />
                  : <SaveButton listingId={id} initialSaved={false} guest listing={{ brand: listing.brand, title: listing.title, image: images[0] ?? null }} />
              )}
            />
            <MeasurementsPanel labels={measLabels} values={measurements} />
          </div>

          {/* RIGHT: purchase placard */}
          <div className="pdp__right">
            <div className="pdp__toprow">
              <span className="pdp__listed">{listedLine}</span>
              <a className="lc-chip" href="#lc-thread" title="Jumps to legit check thread" data-testid="lc-chip">
                <span className="lc-chip__dot" />
                LC {initialTally.legit} LEGIT · {initialTally.verdict} ↓
              </a>
            </div>
            <div className="pdp__brand">{listing.brand.toUpperCase()}</div>
            <h1 className="pdp__title">{listing.title}</h1>
            <div className="pdp__spec">{spec}</div>
            <div className="pdp__pricerow">
              <span className="pdp__price" data-testid="listing-price">
                {listing.is_price_dropped && originalPriceCents && (
                  <span className="pdp__old">{formatCents(originalPriceCents)}</span>
                )}
                {formatCents(listing.price_cents)}
              </span>
              <span className="pdp__ship">+ {formatCents(shippingCents)} SHIPPING · US</span>
              <span className="pdp__listed pdp__listed--m">{listedLine.split(' · ')[0]}</span>
            </div>
            {/* Mobile spec rows (05): SIZE / CONDITION / SHIPPING */}
            <div className="pdp-specs">
              {listing.size && <div className="pdp-specs__row"><span className="pdp-specs__k">SIZE</span><span className="pdp-specs__v">{listing.size.toUpperCase()}</span></div>}
              {listing.color && <div className="pdp-specs__row"><span className="pdp-specs__k">COLOR</span><span className="pdp-specs__v">{listing.color.toUpperCase()}</span></div>}
              <div className="pdp-specs__row"><span className="pdp-specs__k">CONDITION</span><span className="pdp-specs__v">{listing.condition_score ?? '—'} / 10</span></div>
              <div className="pdp-specs__row"><span className="pdp-specs__k">SHIPPING</span><span className="pdp-specs__v">{formatCents(shippingCents)} · US ONLY</span></div>
            </div>

            <div className="pdp__ctas">
              {canBuy ? (
                user ? (
                  <PrefetchLink href={`/checkout/${id}`} className="btn-primary btn-primary--lg" data-testid="buy-now">
                    BUY NOW
                  </PrefetchLink>
                ) : (
                  <GuestAction next={`/checkout/${id}`} testId="buy-guest" className="btn-primary btn-primary--lg">
                    BUY NOW
                  </GuestAction>
                )
              ) : (
                <button type="button" className="btn-primary btn-primary--lg" disabled>
                  {isSeller && isActive ? 'YOUR LISTING' : statusWord}
                </button>
              )}
              {canBuy ? (
                user ? (
                  <a href={`/messages?listing=${id}`} className="btn-ink" data-testid="make-offer">MAKE OFFER</a>
                ) : (
                  <GuestAction next={`/messages?listing=${id}`} testId="offer-guest" className="btn-ink">
                    MAKE OFFER
                  </GuestAction>
                )
              ) : (
                <button type="button" className="btn-ink" disabled>MAKE OFFER</button>
              )}
              <div className="pdp__ctarow">
                {!isSeller && (
                  user
                    ? <SaveButton listingId={id} initialSaved={isSaved} />
                    : <SaveButton listingId={id} initialSaved={false} guest listing={{ brand: listing.brand, title: listing.title, image: images[0] ?? null }} />
                )}
                {canBuy ? (
                  user ? (
                    <MessageSellerButton listingId={id} />
                  ) : (
                    <GuestAction next={`/listings/${id}`} testId="message-guest" className="btn-ghost">
                      MESSAGE SELLER
                    </GuestAction>
                  )
                ) : (
                  <button type="button" className="btn-ghost" disabled>MESSAGE SELLER</button>
                )}
              </div>
              {isSeller && isActive && (
                <div className="stack" style={{ gap: 6, paddingTop: 6 }}>
                  {BUMP_ENABLED && <BumpButton listingId={id} />}
                  {BOOSTED_POSTS_ENABLED && (
                    <PrefetchLink href={`/boost/${listing.id}`} className="btn-ghost">BOOST THIS LISTING →</PrefetchLink>
                  )}
                  <PrefetchLink href={`/sell?edit=${id}`} className="link-underline" style={{ paddingTop: 4 }}>EDIT LISTING →</PrefetchLink>
                </div>
              )}
            </div>

            <div className="pdp__desc">
              <div className="field-label field-label--row">
                <span>DESCRIPTION</span>
                <span>CONDITION {listing.condition_score ?? '—'} / 10</span>
              </div>
              <p style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
            </div>
            <div className="pdp__escrow">
              <span className="lc-chip__dot" />
              ESCROW{authenticated ? ' · AUTHENTICATED' : ' · LEGIT CHECKED'} · TRACKED
            </div>
            <div className="spacer" />
            <div className="pdp__seller">
              <span className="pdp__seller-left">
                <span className="seller-init seller-init--sm">{sellerInitials}</span>
                <span>
                  <PrefetchLink className="pdp__seller-handle" href={seller?.username ? `/sellers/${seller.username}` : '#'}>@{sellerHandle.toUpperCase()}</PrefetchLink>
                  <span className="pdp__seller-meta">{trustLine}</span>
                </span>
              </span>
              <span className="pdp__seller-right">
                {/* Mobile (05): MESSAGE sits in the seller row; the placard's MESSAGE SELLER hides ≤720px. */}
                {canBuy && (
                  user
                    ? <MessageSellerButton listingId={id} className="link-underline link-underline--ink pdp__seller-msg" label="MESSAGE" testId="message-seller-m" />
                    : <GuestAction next={`/listings/${id}`} className="link-underline link-underline--ink pdp__seller-msg">MESSAGE</GuestAction>
                )}
                {FOLLOWS_ENABLED && !isSeller ? (
                  <FollowButton sellerId={listing.seller_id} initialFollowing={isFollowing} small guest={!user} />
                ) : seller?.username ? (
                  <PrefetchLink href={`/sellers/${seller.username}`} className="btn-follow btn-follow--sm">VIEW PROFILE</PrefetchLink>
                ) : null}
              </span>
            </div>
          </div>
        </div>

        {/* Legit check thread (4A) */}
        {(isActive || isSold) && (
          <CommunitySection
            listingId={id}
            isGuest={!user}
            canPost={canPost && isActive}
            closed={isSold}
            initialTally={initialTally}
          />
        )}

        {/* Mobile dock */}
        {canBuy && (
          <div className="pdp-dock">
            {user ? (
              <PrefetchLink href={`/checkout/${id}`} className="btn-primary">BUY NOW · {formatCents(listing.price_cents)}</PrefetchLink>
            ) : (
              <GuestAction next={`/checkout/${id}`} className="btn-primary">BUY NOW · {formatCents(listing.price_cents)}</GuestAction>
            )}
            {user ? (
              <a href={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</a>
            ) : (
              <GuestAction next={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</GuestAction>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
