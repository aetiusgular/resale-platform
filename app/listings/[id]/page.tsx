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
import ListingDescription from './listing-description'
import ListingBack from './listing-back'
import LegitJump from './legit-jump'
import MeasurementsPanel from './measurements-panel'
import ShareSquare from './share-square'
import MoreLots from './more-lots'
import ViewPing from './view-ping'
import FollowButton from '@/app/sellers/[username]/follow-button'
import AppShell from '@/app/components/app-shell'
import GuestAction from '@/app/components/guest-action'
import PrefetchLink from '@/app/components/prefetch-link'
import JsonLd from '@/app/components/json-ld'
import { ChatIcon, HeartIcon } from '@/app/components/icons'
import { Suspense } from 'react'
import { breadcrumbJsonLd, metaDescription, productJsonLd, schemaImages } from '@/lib/seo-listing'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
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

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { view } = await searchParams
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
  // Six positional slots; index 5 is the POSSESSION proof. The gallery is a client component, so
  // only the seller / an admin is handed the full array — everyone else gets slots 0–4 (below).
  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null
  const sellerHandle = d.seller.username
  const sellerInitials = d.seller.initials
  const shippingCents = d.listing.shipping_cents
  // US sellers: automatic US shipping + any regions they priced. Sellers abroad: regions only.
  const lanes = d.listing.shipping
  const intlLine = lanes.regions.map((r) => `${r.label.toUpperCase()} ${r.cents ? formatCents(r.cents) : 'FREE'}`).join(' · ')
  const shipHeadline = lanes.us_domestic ? `+ ${formatCents(shippingCents)} SHIPPING US` : `SHIPS FROM ${lanes.ships_from_name.toUpperCase()}`
  const shipSpec = lanes.us_domestic
    ? `${formatCents(shippingCents)} US${lanes.regions.length ? ` · +${lanes.regions.length} REGIONS` : ' ONLY'}`
    : `FROM ${lanes.ships_from_name.toUpperCase()}`
  const crumbHref = d.listing.crumb.href
  const statusWord = d.listing.status_word
  const listedLine = d.listing.listed_line
  const measurements = d.listing.measurements
  const measLabels = d.listing.measurement_labels
  const savesCount = d.listing.saves_count
  const viewCount = d.listing.view_count
  const trustLine = d.seller.trust_line
  // "View as buyer" preview: the seller opens their own active listing with ?view=buyer to see
  // the buyer placard. Render-only — data-level isSeller (edit rights, possession photo) is
  // untouched; only what the placard shows flips. viewIsSeller drives the seller-vs-buyer chrome.
  const asBuyer = isSeller && isActive && view === 'buyer'
  const viewIsSeller = isSeller && !asBuyer
  const showBuyerCtas = canBuy || asBuyer
  // "LISTED 16H AGO" / "SOLD 2D AGO" — the saved count after the middot is not shown here.
  const listedWord = listedLine.split(' · ')[0]
  // "XS BLACK" — one mono line under the title (desktop; ≤960px uses the spec rows instead).
  const spec = [listing.size, listing.color].filter(Boolean).map((part) => String(part).toUpperCase()).join(' ')
  // Avatar + handle + trust facts; wrapped in the profile link below when the seller has a username.
  const sellerMetaLine = viewIsSeller
    ? [`${viewCount} VIEWS`, `${savesCount} SAVES`]   // seller sees their own listing's stats
    : trustLine.split(' · ')
  const sellerIdentity = (
    <>
      <span className="seller-init seller-init--sm" aria-hidden="true">{sellerInitials}</span>
      <span>
        <span className="pdp__seller-handle">@{sellerHandle.toUpperCase()}</span>
        <span className="pdp__seller-meta">{sellerMetaLine.map((part, i) => <span key={i}>{part}</span>)}</span>
      </span>
    </>
  )
  // Reading-pane dock/message controls (R5B "open"), composed here so auth logic stays server-side.
  const readerBuy = showBuyerCtas ? (
    user
      ? <PrefetchLink href={`/checkout/${id}`} className="btn-primary btn-primary--lg">BUY NOW</PrefetchLink>
      : <GuestAction next={`/checkout/${id}`} className="btn-primary btn-primary--lg">BUY NOW</GuestAction>
  ) : null
  const readerOffer = showBuyerCtas ? (
    user
      ? <a href={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</a>
      : <GuestAction next={`/messages?listing=${id}`} className="btn-ink">MAKE OFFER</GuestAction>
  ) : null
  const readerMsg = showBuyerCtas ? (
    user
      ? <MessageSellerButton listingId={id} className="pdp-reader__msg" label="Message seller" testId="message-seller-reader" iconSize={16} />
      : <GuestAction next={`/listings/${id}`} className="pdp-reader__msg"><ChatIcon size={16} />Message seller</GuestAction>
  ) : null

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

      {asBuyer && (
        <div className="status-strip">
          PREVIEW — VIEWING AS A BUYER.
          <PrefetchLink href={`/listings/${id}`} prefetch={false} className="link-underline link-underline--ink" style={{ marginLeft: 16 }}>EXIT PREVIEW →</PrefetchLink>
        </div>
      )}

      <main className="pdp-page">
        <div className="pdp">
          {/* LEFT: back link, gallery (stage + thumb strip in one grid), measurements.
              ≤960px both columns unwrap into one stack (globals.css `.pdp` rules). */}
          <div className="pdp__left">
            <ListingBack href={crumbHref} />
            {/* Save moved off the stage into the buy row (desktop) and the dock (≤960), with its
                count. Measurements moved into the right rail (pinned to the photo's bottom line). */}
            <ListingGallery
              images={(isSeller || isAdmin) && !asBuyer ? images : images.slice(0, 5)}
              title={listing.title}
              showPossession={(isSeller || isAdmin) && !asBuyer}
              legitSlot={<LegitJump count={initialTally.legit} />}
            />
          </div>

          {/* RIGHT: purchase placard — one lockup (listed / legit, brand + save, title, spec,
              price, shipping), the CTAs, description, seller. */}
          <div className="pdp__right">
            <div className="pdp__lockup">
              {/* Top meta carries the seller status only; buyers now see the brand first.
                  Listed time moved to a footnote below measurements (A3); legit moved to the
                  image badge (B2). */}
              {viewIsSeller && (
                <div className="pdp__meta">
                  <span className="pdp__listed">YOUR LISTING · {listing.status.toUpperCase()}</span>
                </div>
              )}
              <div className="pdp__brand-row">
                <div className="pdp__brand">{listing.brand.toUpperCase()}</div>
                {/* Save — minimal borderless bookmark + count, inline at the right of the brand
                    line (desktop). Non-sellers only; ≤960 the dock carries the save instead. */}
                {!viewIsSeller && (
                  user ? (
                    <SaveButton listingId={id} initialSaved={isSaved} className="pdp__save-inline" iconSize={20} count={savesCount} />
                  ) : (
                    <SaveButton listingId={id} initialSaved={false} guest listing={{ brand: listing.brand, title: listing.title, image: images[0] ?? null }} className="pdp__save-inline" iconSize={20} count={savesCount} />
                  )
                )}
              </div>
              <h1 className="pdp__title">{listing.title}</h1>
              {spec ? <div className="pdp__spec">{spec}</div> : null}
              <div className="pdp__pricerow">
                <span className="pdp__price" data-testid="listing-price">
                  {listing.is_price_dropped && originalPriceCents && (
                    <span className="pdp__old">{formatCents(originalPriceCents)}</span>
                  )}
                  {formatCents(listing.price_cents)}
                </span>
                <span className="pdp__ship">{shipHeadline}</span>
              </div>
              {intlLine && <div className="pdp__ship-intl" data-testid="listing-intl-shipping">{lanes.us_domestic ? 'ALSO SHIPS TO ' : 'SHIPS TO '}{intlLine}</div>}
            </div>
            {/* Spec rows, ≤960px only: SIZE / COLOR / SHIPPING */}
            <div className="pdp-specs">
              {listing.size && <div className="pdp-specs__row"><span className="pdp-specs__k">SIZE</span><span className="pdp-specs__v">{listing.size.toUpperCase()}</span></div>}
              {listing.color && <div className="pdp-specs__row"><span className="pdp-specs__k">COLOR</span><span className="pdp-specs__v">{listing.color.toUpperCase()}</span></div>}
              <div className="pdp-specs__row"><span className="pdp-specs__k">SHIPPING</span><span className="pdp-specs__v">{shipSpec}</span></div>
            </div>

            {/* BUYER CTAs — hidden ≤960 (the dock takes over). Shown to buyers, and to the
                seller in ?view=buyer preview. A real seller (not previewing) gets pdp__owner below. */}
            <div className="pdp__ctas">
              {showBuyerCtas ? (
                <>
                  <div className="pdp__buyrow">
                    {user ? (
                      <PrefetchLink href={`/checkout/${id}`} className="btn-primary btn-primary--lg" data-testid="buy-now">BUY NOW</PrefetchLink>
                    ) : (
                      <GuestAction next={`/checkout/${id}`} testId="buy-guest" className="btn-primary btn-primary--lg">BUY NOW</GuestAction>
                    )}
                    {user ? (
                      <a href={`/messages?listing=${id}`} className="btn-ink" data-testid="make-offer">MAKE OFFER</a>
                    ) : (
                      <GuestAction next={`/messages?listing=${id}`} testId="offer-guest" className="btn-ink">MAKE OFFER</GuestAction>
                    )}
                  </div>
                  {user ? (
                    <MessageSellerButton listingId={id} />
                  ) : (
                    <GuestAction next={`/listings/${id}`} testId="message-guest" className="pdp__msg"><ChatIcon size={20} />Message seller</GuestAction>
                  )}
                </>
              ) : viewIsSeller && isActive ? null : (
                <>
                  <div className="pdp__buyrow">
                    <button type="button" className="btn-primary btn-primary--lg" disabled>{statusWord}</button>
                    <button type="button" className="btn-ink" disabled>MAKE OFFER</button>
                  </div>
                  <button type="button" className="pdp__msg" disabled><ChatIcon size={20} />Message seller</button>
                </>
              )}
            </div>

            {/* SELLER owner controls — the seller's own active listing. Visible desktop AND ≤960
                (unlike pdp__ctas, which the dock replaces on mobile). Keeps every existing action:
                EDIT LISTING, BUMP, BOOST — plus VIEW AS BUYER and the saves tally. */}
            {viewIsSeller && isActive && (
              <div className="pdp__owner" data-testid="seller-controls">
                <div className="pdp__buyrow">
                  <PrefetchLink href={`/sell?edit=${id}`} className="btn-primary btn-primary--lg" data-testid="edit-listing">EDIT LISTING</PrefetchLink>
                  <PrefetchLink href={`/listings/${id}?view=buyer`} prefetch={false} className="btn-ink" data-testid="view-as-buyer">VIEW AS BUYER</PrefetchLink>
                  <span className="pdp__save-square pdp__save-stat" aria-label={`${savesCount} people saved this`} title="Saves">
                    <HeartIcon filled={false} size={20} />
                    <span className="pdp__save-count">{savesCount}</span>
                  </span>
                </div>
                {(BUMP_ENABLED || BOOSTED_POSTS_ENABLED) && (
                  <div className="pdp__ownerrow">
                    {BUMP_ENABLED && <BumpButton listingId={id} />}
                    {BOOSTED_POSTS_ENABLED && (
                      <PrefetchLink href={`/boost/${listing.id}`} className="btn-ghost">BOOST · FROM $6</PrefetchLink>
                    )}
                    {/* ··· overflow — share the listing (the grid's sixth cell, R5B seller view). */}
                    <ShareSquare url={`/listings/${id}`} />
                  </div>
                )}
              </div>
            )}

            <div className="pdp__seller">
              {/* Seller identity — sits ABOVE the description (R5B rail order). The whole block is
                  the profile link (it replaced the VIEW PROFILE button). */}
              {seller?.username ? (
                <PrefetchLink className="pdp__seller-left" href={`/sellers/${seller.username}`}>
                  {sellerIdentity}
                  <span className="sr-only">, view profile</span>
                </PrefetchLink>
              ) : (
                <span className="pdp__seller-left">{sellerIdentity}</span>
              )}
              <span className="pdp__seller-right">
                {/* ≤960px: Message sits in the seller row; the placard's Message seller link hides with the CTAs. */}
                {showBuyerCtas && (
                  user
                    ? <MessageSellerButton listingId={id} className="link-underline link-underline--ink pdp__seller-msg" label="Message" testId="message-seller-m" iconSize={16} />
                    : <GuestAction next={`/listings/${id}`} className="link-underline link-underline--ink pdp__seller-msg"><ChatIcon size={16} />Message</GuestAction>
                )}
                {FOLLOWS_ENABLED && !viewIsSeller ? (
                  <FollowButton sellerId={listing.seller_id} initialFollowing={isFollowing} small guest={!user} />
                ) : null}
              </span>
            </div>

            {/* Description flex-grows to fill the rail; READ FULL flips it into the reading pane
                (R5B "open"). Measurements pin to the bottom (the photo's line) on every listing. */}
            <ListingDescription
              text={listing.description ?? ''}
              brand={listing.brand}
              title={listing.title}
              spec={spec}
              priceDisplay={formatCents(listing.price_cents)}
              shipDisplay={shipHeadline}
              buyNode={readerBuy}
              offerNode={readerOffer}
              messageNode={readerMsg}
            />
            <MeasurementsPanel
              labels={measLabels}
              values={measurements}
              listingId={id}
              canRequest={canBuy && !!user}
              guest={canBuy && !user}
              initialRequested={d.viewer.measurement_requested}
            />
            {/* Listed time as a faint footnote at the bottom of the rail (A3). */}
            <p className="pdp__listed-foot">{listedWord}</p>
          </div>
        </div>

        {/* Legit check + seller band: the thread fills the left, the minimal seller sits inline
            on the right (desktop). ≤960 the band stacks to just the thread; the seller stays in
            the placard flow above. */}
        {(isActive || isSold) && (
          <div className="pdp-band">
            <CommunitySection
              listingId={id}
              isGuest={!user}
              canPost={canPost}
              closed={isSold}
              initialTally={initialTally}
            />
            <aside className="pdp-seller-rail" aria-label="Seller">
              {seller?.username ? (
                <PrefetchLink className="pdp__seller-left" href={`/sellers/${seller.username}`}>
                  {sellerIdentity}
                  <span className="sr-only">, view profile</span>
                </PrefetchLink>
              ) : (
                <span className="pdp__seller-left">{sellerIdentity}</span>
              )}
              {FOLLOWS_ENABLED && !viewIsSeller && (
                <FollowButton sellerId={listing.seller_id} initialFollowing={isFollowing} small guest={!user} />
              )}
            </aside>
          </div>
        )}

        {/* more lots — streams in after the placard; renders nothing without at least two lots */}
        {(isActive || isSold) && (
          <Suspense fallback={null}>
            <MoreLots
              supabase={supabase}
              user={user}
              listing={{ id: listing.id, category: listing.category, department: listing.department }}
              showAuthBadge={d.flags.auth_badge}
            />
          </Suspense>
        )}

        {/* Mobile dock (≤960) — buyer actions, with the save square + count at the end so the
            save sits with the decision on mobile too (it left the stage). */}
        {showBuyerCtas && (
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
            {user ? (
              <SaveButton listingId={id} initialSaved={isSaved} className="pdp__save-square pdp-dock__save" iconSize={20} count={savesCount} />
            ) : (
              <SaveButton listingId={id} initialSaved={false} guest listing={{ brand: listing.brand, title: listing.title, image: images[0] ?? null }} className="pdp__save-square pdp-dock__save" iconSize={20} count={savesCount} />
            )}
          </div>
        )}
      </main>
    </AppShell>
  )
}
