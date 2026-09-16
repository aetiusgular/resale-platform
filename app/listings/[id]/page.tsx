import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getListing } from './get-listing'
import { formatCents } from '@/lib/fees'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED, FOLLOWS_ENABLED } from '@/lib/flags'
import { loadListingDetail, type ListingRow } from '@/lib/loaders/listing'
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
import { ArrowLeftIcon, ChatIcon } from '@/app/components/icons'
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

  // ONE data assembly shared with GET /api/listings/[id] (native clients).
  // null = not visible to this viewer (non-active and not seller/admin) → 404, as before.
  const d = await loadListingDetail({ supabase, user, id, row: listing as unknown as ListingRow })
  if (!d) notFound()

  const isActive = listing.status === 'active'
  const isSold = listing.status === 'sold'
  const { is_seller: isSeller, is_admin: isAdmin, saved: isSaved, following: isFollowing, can_buy: canBuy, can_post: canPost } = d.viewer
  const currentUsername = d.viewer.username
  const originalPriceCents = d.listing.original_price_cents
  const initialTally = d.lc
  // Gallery gets every slot; it hides the POSSESSION slot unless showPossession.
  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null
  const sellerHandle = d.seller.username
  const sellerInitials = d.seller.initials
  const shippingCents = d.listing.shipping_cents
  const crumbParts = d.listing.crumb.parts
  const crumbHref = d.listing.crumb.href
  const statusWord = d.listing.status_word
  const listedLine = d.listing.listed_line
  const measurements = d.listing.measurements
  const measLabels = d.listing.measurement_labels
  const trustLine = d.seller.trust_line

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

      <main className="pdp-page">
        <div className="pdp">
          {/* LEFT: gallery + measurements (4A). ≤720px both columns unwrap into one
              stack ordered like the mobile-web 05 mock (globals.css `.pdp` rules). */}
          <div className="pdp__left">
            <PrefetchLink className="pdp__crumb" href={crumbHref}>
              <span className="pdp__crumb-full"><ArrowLeftIcon size={12} />SEARCH<span className="sep" aria-hidden="true" />{crumbParts.map((p) => p.toUpperCase()).join(' / ')}</span>
              <span className="pdp__crumb-short"><ArrowLeftIcon size={12} />BACK TO RESULTS</span>
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
              <span className="pdp__listed">{listedLine.split(' · ')[0]}</span>
              <a className="pdp__legit-link" href="#lc-thread" title="Jumps to the legit check thread" data-testid="lc-chip">{initialTally.legit} legit</a>
            </div>
            <div className="pdp__caption">
              <div className="pdp__caption-main">
                <div className="pdp__brand">{listing.brand.toUpperCase()}</div>
                <h1 className="pdp__title">{listing.title}</h1>
                <div className="pdp__spec">
                  {listing.size && <span className="pdp__fact">{listing.size.toUpperCase()}</span>}
                  {listing.color && <span className="pdp__fact">{listing.color.toUpperCase()}</span>}
                </div>
              </div>
              {!isSeller && (
                user
                  ? <SaveButton listingId={id} initialSaved={isSaved} className="pdp__caption-save" />
                  : <SaveButton listingId={id} initialSaved={false} guest listing={{ brand: listing.brand, title: listing.title, image: images[0] ?? null }} className="pdp__caption-save" />
              )}
            </div>
            <div className="pdp__pricerow">
              <span className="pdp__price" data-testid="listing-price">
                {listing.is_price_dropped && originalPriceCents && (
                  <span className="pdp__old">{formatCents(originalPriceCents)}</span>
                )}
                {formatCents(listing.price_cents)}
              </span>
              <span className="pdp__ship">+ {formatCents(shippingCents)} SHIPPING<span className="sep" aria-hidden="true" />US</span>
              <span className="pdp__listed pdp__listed--m">{listedLine.split(' · ')[0]}</span>
            </div>
            {/* Mobile spec rows (05): SIZE / COLOR / SHIPPING */}
            <div className="pdp-specs">
              {listing.size && <div className="pdp-specs__row"><span className="pdp-specs__k">SIZE</span><span className="pdp-specs__v">{listing.size.toUpperCase()}</span></div>}
              {listing.color && <div className="pdp-specs__row"><span className="pdp-specs__k">COLOR</span><span className="pdp-specs__v">{listing.color.toUpperCase()}</span></div>}
              <div className="pdp-specs__row"><span className="pdp-specs__k">SHIPPING</span><span className="pdp-specs__v">{formatCents(shippingCents)}<span className="sep" aria-hidden="true" />US ONLY</span></div>
            </div>

            <div className="pdp__ctas">
              <div className="pdp__buyrow">
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
              </div>
              {canBuy ? (
                user ? (
                  <MessageSellerButton listingId={id} />
                ) : (
                  <GuestAction next={`/listings/${id}`} testId="message-guest" className="pdp__msg">
                    <ChatIcon size={18} />Message seller
                  </GuestAction>
                )
              ) : (
                <button type="button" className="pdp__msg" disabled><ChatIcon size={18} />Message seller</button>
              )}
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
              </div>
              <p style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
            </div>
            <div className="spacer" />
            <div className="pdp__seller">
              {seller?.username ? (
                <PrefetchLink className="pdp__seller-left" href={`/sellers/${seller.username}`} aria-label={`${sellerHandle} profile`}>
                  <span className="seller-init seller-init--sm">{sellerInitials}</span>
                  <span>
                    <span className="pdp__seller-handle">@{sellerHandle.toUpperCase()}</span>
                    <span className="pdp__seller-meta">{trustLine.split(' · ').map((part) => <span key={part}>{part}</span>)}</span>
                  </span>
                </PrefetchLink>
              ) : (
                <span className="pdp__seller-left">
                  <span className="seller-init seller-init--sm">{sellerInitials}</span>
                  <span>
                    <span className="pdp__seller-handle">@{sellerHandle.toUpperCase()}</span>
                    <span className="pdp__seller-meta">{trustLine.split(' · ').map((part) => <span key={part}>{part}</span>)}</span>
                  </span>
                </span>
              )}
              <span className="pdp__seller-right">
                {/* Mobile (05): Message sits in the seller row; the placard text link hides ≤720px. */}
                {canBuy && (
                  user
                    ? <MessageSellerButton listingId={id} className="link-underline link-underline--ink pdp__seller-msg" label="MESSAGE" testId="message-seller-m" iconSize={16} />
                    : <GuestAction next={`/listings/${id}`} className="link-underline link-underline--ink pdp__seller-msg"><ChatIcon size={16} />MESSAGE</GuestAction>
                )}
                {FOLLOWS_ENABLED && !isSeller ? (
                  <FollowButton sellerId={listing.seller_id} initialFollowing={isFollowing} small guest={!user} />
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
            canPost={canPost}
            closed={isSold}
            initialTally={initialTally}
          />
        )}

        {/* Mobile dock */}
        {canBuy && (
          <div className="pdp-dock">
            {user ? (
              <PrefetchLink href={`/checkout/${id}`} className="btn-primary">BUY NOW</PrefetchLink>
            ) : (
              <GuestAction next={`/checkout/${id}`} className="btn-primary">BUY NOW</GuestAction>
            )}
            {user ? (
              <a href={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</a>
            ) : (
              <GuestAction next={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</GuestAction>
            )}
          </div>
        )}
      </main>
    </AppShell>
  )
}
