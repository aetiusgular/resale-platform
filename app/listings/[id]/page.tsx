import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getListing } from './get-listing'
import { formatCents } from '@/lib/fees'
import { BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { BUMP_ENABLED } from '@/lib/flags'
import { CONDITION_DEFINITIONS } from '@/lib/condition'
import ConditionPopover from './condition-popover'
import ListingActions from './listing-actions'
import BumpButton from './bump-button'
import CommunitySection from './community-section'
import ListingGallery from './gallery'
import PdpSidebar from './pdp-sidebar'
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import JsonLd from '@/app/components/json-ld'
import { breadcrumbJsonLd, metaDescription, productJsonLd, schemaImages } from '@/lib/seo-listing'
import { isOfflinePreview } from '@/app/preview/offline'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const data = await getListing(id)

  // Same behavior as the old status='active' filter for public viewers; the
  // seller/admin (who can fetch non-active rows) just get the real title.
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
  const offline = isOfflinePreview()
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null
  if (!offline) {
    try {
      supabase = await createClient()
    } catch {
      // Broken env — continue as guest offline; getListing already fixtures.
      supabase = null
    }
  }

  // Fetch user + listing in parallel (both independent). getListing is
  // cache()-shared with generateMetadata — this resolves from the same flight.
  const [{ data: { user } }, listing] = await Promise.all([
    supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }),
    getListing(id),
  ])

  if (!listing) notFound()

  // Profile, save check, and price history — run in parallel after we have user + listing
  let isAdmin = false
  const isSeller = user?.id === listing.seller_id
  let userProfile: { role?: string; id_verification_status?: string; verified_checker?: boolean; tier?: string; is_moderator?: boolean } | null = null
  let currentUsername = ''
  let isSaved = false
  let originalPriceCents: number | null = null
  let legitCheckCount = 0

  if (supabase) {
    const { count: lcCount } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', id)
      .eq('thread_type', 'lc')
    legitCheckCount = lcCount ?? 0
  }

  if (user && supabase) {
    const [profileResult, saveResult, priceResult] = await Promise.all([
      supabase.from('profiles').select('role, id_verification_status, verified_checker, tier, is_moderator, username').eq('id', user.id).single(),
      supabase.from('saves').select('id').eq('user_id', user.id).eq('listing_id', id).maybeSingle(),
      listing.is_price_dropped
        ? supabase.from('price_history').select('old_price_cents').eq('listing_id', id).order('changed_at', { ascending: true }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    isAdmin = profileResult.data?.role === 'admin'
    userProfile = profileResult.data
    currentUsername = (profileResult.data?.username as string) ?? ''
    isSaved = !!saveResult.data
    originalPriceCents = priceResult.data?.old_price_cents ?? null
  } else if (listing.is_price_dropped) {
    if (supabase) {
      const { data: firstHistory } = await supabase
        .from('price_history').select('old_price_cents').eq('listing_id', id)
        .order('changed_at', { ascending: true }).limit(1).maybeSingle()
      originalPriceCents = firstHistory?.old_price_cents ?? null
    } else if ('original_price_cents' in listing) {
      originalPriceCents = listing.original_price_cents ?? null
    }
  }

  // If non-active and not admin/seller, 404
  if (listing.status !== 'active' && !isAdmin && !isSeller) {
    notFound()
  }

  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null
  const sellerVerified = seller?.id_verification_status === 'verified'
  const itemAuthenticated = listing.authentication_status === 'authenticated'
  const trustRows: { label: string; desc: string; href?: string }[] = []
  if (legitCheckCount > 0) {
    trustRows.push({
      label: `${legitCheckCount} legit check${legitCheckCount === 1 ? '' : 's'}`,
      desc: 'from the community',
      href: '#legit-checks',
    })
  }
  trustRows.push({ label: 'Escrow', desc: 'held until delivery confirmed' })

  // Fee Model v3: buyers pay no platform fee — the listed price is what they pay.
  const total = listing.price_cents
  const priceLabel = formatCents(total)
  const listedAgo = formatTimeAgo(listing.created_at)
  const showCommerce = listing.status === 'active' && !isSeller
  const buyDisabledLabel =
    listing.status === 'sold'
      ? 'Sold'
      : listing.status === 'pending_escrow'
        ? 'Pending'
        : listing.status !== 'active'
          ? 'Unavailable'
          : isSeller
            ? null
            : null

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      {/* currentUsername is '' for guests → SiteHeader renders its Sign-in variant. */}
      <SiteHeader username={currentUsername} />

      {/* Merchant-listing structured data — public (active) listings only.
          Sold listings 404 publicly this phase; the SoldOut branch lands with
          the public sold archive (SEO2, with HF7). */}
      {listing.status === 'active' && (
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

      {/* Seller status banners */}
      {isSeller && listing.status === 'pending_review' && (
        <div className="inset-band" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          REVIEW: PENDING — your listing is in the queue
        </div>
      )}
      {isSeller && listing.status === 'removed' && listing.rejection_reason && (
        <div className="inset-band" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-alert)', fontSize: '13px', color: 'var(--color-alert)' }}>
          Listing rejected: {listing.rejection_reason}
        </div>
      )}
      {isAdmin && listing.status !== 'active' && (
        <div className="inset-band" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>ADMIN VIEW | STATUS: {listing.status.toUpperCase()}</span>
          <Link href="/admin/queue" style={{ fontSize: '12px', color: 'var(--color-ink)' }}>← queue</Link>
        </div>
      )}

      <div className="listing-detail-inner page-inset page-enter" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '32px', paddingBottom: '64px' }}>
        {/*
          Desktop: gallery (dominant) | sticky commerce
          Mobile:  gallery → commerce → description (CSS order)
        */}
        <div className="pdp-layout">
          <div className="pdp-gallery-col">
            <ListingGallery images={images} title={listing.title} />
          </div>

          <aside className="pdp-commerce" aria-label="Buy this listing">
            <div className="pdp-commerce-sticky">
              {/* Hierarchy: brand → title → price → facts (browse caption cohesion) */}
              <header className="pdp-record">
                <p className="pdp-brand">{listing.brand}</p>
                <h1 className="pdp-title">{listing.title}</h1>
                <p className="pdp-price">
                  {listing.is_price_dropped && originalPriceCents ? (
                    <>
                      <span className="pdp-price-was">{formatCents(originalPriceCents)}</span>
                      {priceLabel}
                    </>
                  ) : (
                    priceLabel
                  )}
                </p>
                <p className="pdp-facts">
                  {listing.size}
                  <span className="pdp-facts-sep" aria-hidden> · </span>
                  {listing.condition_score}/10
                  <span className="pdp-facts-sep" aria-hidden> · </span>
                  listed {listedAgo}
                </p>
              </header>

              <div className="pdp-commerce-chunk">
                <ListingActions
                  listingId={id}
                  title={listing.title}
                  priceLabel={priceLabel}
                  initialSaved={isSaved}
                  guest={!user}
                  user={!!user}
                  showCommerce={showCommerce}
                  buyDisabledLabel={buyDisabledLabel}
                />
              </div>

              <div className="pdp-commerce-chunk">
                <PdpSidebar
                  sellerUsername={seller?.username ?? null}
                  sellerVerified={sellerVerified}
                  listedAgo={listedAgo}
                />
              </div>

              <div className="pdp-ledger" aria-label="Provenance ledger">
                <div className="pdp-ledger-row pdp-ledger-row--inline">
                  <span className="pdp-ledger-label">condition {listing.condition_score}/10</span>
                  <ConditionPopover
                    score={listing.condition_score}
                    definition={CONDITION_DEFINITIONS[listing.condition_score]}
                  />
                </div>
                {itemAuthenticated && (
                  <div className="pdp-ledger-row">
                    <span className="pdp-ledger-label">Authenticated</span>
                    <span className="pdp-ledger-detail">reviewed pre-publish</span>
                  </div>
                )}
                {sellerVerified && !itemAuthenticated && (
                  <div className="pdp-ledger-row">
                    <span className="pdp-ledger-label">Seller ID</span>
                    <span className="pdp-ledger-detail">confirmed</span>
                  </div>
                )}
                {trustRows.map((row) =>
                  row.href ? (
                    <a key={row.label} href={row.href} className="pdp-ledger-row pdp-ledger-row--link">
                      <span className="pdp-ledger-label">{row.label}</span>
                      <span className="pdp-ledger-detail">{row.desc}</span>
                    </a>
                  ) : (
                    <div key={row.label} className="pdp-ledger-row">
                      <span className="pdp-ledger-label">{row.label}</span>
                      <span className="pdp-ledger-detail">{row.desc}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </aside>

          {/* Under gallery on desktop; after commerce on mobile (grid order) */}
          <div className="pdp-below">
            {(listing.description || listing.condition_notes) && (
              <div className="pdp-description">
                {listing.description && <p>{listing.description}</p>}
                {listing.condition_notes && (
                  <p className="pdp-description-notes">{listing.condition_notes}</p>
                )}
              </div>
            )}

            {isSeller && listing.status === 'active' && BOOSTED_POSTS_ENABLED && (
              <Link href={`/boost/${listing.id}`} className="pdp-seller-tool">
                Boost this listing →
              </Link>
            )}

            {BUMP_ENABLED && isSeller && listing.status === 'active' && (
              <div className="pdp-seller-tool">
                <BumpButton listingId={id} />
              </div>
            )}

            {listing.status === 'active' && !offline && (
              <div className="pdp-community">
                <CommunitySection
                  listingId={id}
                  isGuest={!user}
                  canPostLc={
                    userProfile?.is_moderator === true ||
                    userProfile?.role === 'admin'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileTabBar username={currentUsername} />
    </div>
  )
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
