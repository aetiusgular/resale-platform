import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getListing } from './get-listing'
import { formatCents } from '@/lib/fees'
import { BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { BUMP_ENABLED } from '@/lib/flags'
import { CONDITION_DEFINITIONS, PHOTO_SLOTS } from '@/lib/condition'
import ConditionPopover from './condition-popover'
import SaveButton from './save-button'
import MessageSellerButton from './message-seller-button'
import BumpButton from './bump-button'
import CommunitySection from './community-section'
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import GuestAction from '@/app/components/guest-action'
import JsonLd from '@/app/components/json-ld'
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

  // Profile, save check, and price history — run in parallel after we have user + listing
  let isAdmin = false
  const isSeller = user?.id === listing.seller_id
  let userProfile: { role?: string; id_verification_status?: string; verified_checker?: boolean; tier?: string; is_moderator?: boolean } | null = null
  let currentUsername = ''
  let isSaved = false
  let originalPriceCents: number | null = null

  if (user) {
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
    const { data: firstHistory } = await supabase
      .from('price_history').select('old_price_cents').eq('listing_id', id)
      .order('changed_at', { ascending: true }).limit(1).maybeSingle()
    originalPriceCents = firstHistory?.old_price_cents ?? null
  }

  // If non-active and not admin/seller, 404
  if (listing.status !== 'active' && !isAdmin && !isSeller) {
    notFound()
  }

  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const frontImage = images[0] ?? null
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null

  // Fee Model v3: buyers pay no platform fee — the listed price is what they pay.
  const total   = listing.price_cents
  const listedAgo = formatTimeAgo(listing.created_at)

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
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          REVIEW: PENDING — your listing is in the queue
        </div>
      )}
      {isSeller && listing.status === 'removed' && listing.rejection_reason && (
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-alert)', padding: '10px 16px', fontSize: '13px', color: 'var(--color-alert)' }}>
          Listing rejected: {listing.rejection_reason}
        </div>
      )}
      {isAdmin && listing.status !== 'active' && (
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>ADMIN VIEW · STATUS: {listing.status.toUpperCase()}</span>
          <Link href="/admin/queue" style={{ fontSize: '12px', color: 'var(--color-ink)' }}>← queue</Link>
        </div>
      )}

      <div className="listing-detail-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 80px 64px' }}>
        <div className="listing-detail-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '48px', alignItems: 'start' }}>

          {/* LEFT: Gallery */}
          <div>
            {/* Main image */}
            <div style={{ aspectRatio: '3/4', boxSizing: 'border-box', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {frontImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frontImage} alt={listing.title} fetchPriority="high" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>3 : 4 — FRONT</span>
              )}
            </div>

            {/* Thumbnails */}
            <div className="listing-thumbnails" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '16px' }}>
              {PHOTO_SLOTS.map((slot, idx) => {
                const url = images[idx]
                const label = slot.charAt(0) + slot.slice(1).toLowerCase()
                const isPossession = slot === 'POSSESSION'
                return (
                  <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ position: 'relative', aspectRatio: '3/4', boxSizing: 'border-box', border: `1px solid ${idx === 0 ? 'var(--color-ink)' : 'var(--color-line)'}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-ink-soft)' }}>3 : 4</span>
                      )}
                      {isPossession && url && (
                        <span style={{ position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px', background: 'var(--color-accent)', borderRadius: '2px', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', lineHeight: 1 }}>✓</span>
                      )}
                    </div>
                    <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: idx === 0 ? 'var(--color-ink)' : 'var(--color-ink-soft)', textAlign: 'center' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Purchase panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Title — server-rendered for SEO */}
            <h1 style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '20px', lineHeight: 1.35, letterSpacing: 0, color: 'var(--color-ink)', margin: 0 }}>
              {listing.title}
            </h1>
            <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--color-ink)' }}>
              {listing.brand} · {listing.size}
            </div>
            {listing.authentication_status === 'authenticated' && (
              <div style={{ marginTop: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
                ✓ AUTHENTICATED
              </div>
            )}

            {/* Condition + popover */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
                CONDITION {listing.condition_score}/10
              </span>
              <ConditionPopover
                score={listing.condition_score}
                definition={CONDITION_DEFINITIONS[listing.condition_score]}
              />
            </div>

            {/* Price block */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '28px', color: 'var(--color-ink)' }}>
                {listing.is_price_dropped && originalPriceCents ? (
                  <>
                    <span style={{ color: 'var(--color-ink-soft)', textDecoration: 'line-through', fontWeight: 400, fontSize: '20px', marginRight: '8px' }}>
                      {formatCents(originalPriceCents)}
                    </span>
                    {formatCents(listing.price_cents)}
                  </>
                ) : (
                  formatCents(listing.price_cents)
                )}
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                no buyer fee — you pay the listed price. that&apos;s it.
              </div>
              {isSeller && listing.status === 'active' && BOOSTED_POSTS_ENABLED && (
                <Link href={`/boost/${listing.id}`} style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  Boost this listing →
                </Link>
              )}
            </div>

            {/* TRUST STRIP */}
            <div style={{ marginTop: '24px', border: '1px solid var(--color-line)', borderRadius: '2px' }}>
              {[
                { label: 'VERIFIED', desc: 'AI + human reviewed' },
                { label: 'COMMUNITY CHECKED', desc: '0 legit checks' },
                { label: 'ESCROW', desc: 'your money is held until you confirm delivery' },
              ].map((row, i) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--color-line)' }}>
                  <span style={{ color: 'var(--color-accent)', fontSize: '13px', flex: 'none' }}>✓</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink)', flex: 'none' }}>{row.label}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-ink-soft)' }}>{row.desc}</span>
                </div>
              ))}
            </div>

            {/* BUY / OFFER buttons */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Buy now: authed buyer → checkout; guest → popup (returns to checkout);
                  otherwise (sold/pending/own listing) → disabled. */}
              {listing.status === 'active' && !isSeller ? (
                user ? (
                  <Link
                    href={`/checkout/${id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}
                  >
                    Buy now — {formatCents(total)}
                  </Link>
                ) : (
                  <GuestAction
                    next={`/checkout/${id}`}
                    testId="buy-guest"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)' }}
                  >
                    Buy now — {formatCents(total)}
                  </GuestAction>
                )
              ) : (
                <button
                  disabled
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
                >
                  {listing.status === 'sold' ? 'SOLD' : listing.status === 'pending_escrow' ? 'PENDING' : 'Buy now'}
                </button>
              )}
              {listing.status === 'active' && !isSeller ? (
                user ? (
                  <a
                    href={`/messages?listing=${id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}
                  >
                    Make offer
                  </a>
                ) : (
                  <GuestAction
                    next={`/messages?listing=${id}`}
                    testId="offer-guest"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)' }}
                  >
                    Make offer
                  </GuestAction>
                )
              ) : (
                <button
                  disabled
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
                >
                  Make offer
                </button>
              )}
              {listing.status === 'active' && !isSeller ? (
                user ? (
                  <MessageSellerButton listingId={id} />
                ) : (
                  <GuestAction
                    next={`/listings/${id}`}
                    testId="message-guest"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid transparent', borderRadius: '2px', font: '500 14px var(--font-ui)' }}
                  >
                    Message seller
                  </GuestAction>
                )
              ) : (
                <button
                  disabled
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid transparent', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
                >
                  Message seller
                </button>
              )}
            </div>

            {/* Seller bump control — own active listing only (G7, behind BUMP_ENABLED) */}
            {BUMP_ENABLED && isSeller && listing.status === 'active' && (
              <div style={{ marginTop: '16px' }}>
                <BumpButton listingId={id} />
              </div>
            )}

            {/* Seller block */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-line)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Link href={seller?.username ? `/sellers/${seller.username}` : '#'} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>@{seller?.username ?? '—'}</Link>
                {/* Tier badge stub — B2 uses Bronze as placeholder */}
                <span style={{ display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', border: '1px solid var(--color-line)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Bronze</span>
                {seller?.id_verification_status === 'verified' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>VERIFIED ID</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                SHIPS FROM · US
              </div>
            </div>

            {/* Save + meta line */}
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                LISTED {listedAgo.toUpperCase()} · {listing.saves_count ?? 0} SAVED
              </div>
              {!isSeller && (
                user
                  ? <SaveButton listingId={id} initialSaved={isSaved} />
                  : <SaveButton listingId={id} initialSaved={false} guest />
              )}
            </div>
          </div>
        </div>

        {/* Community section — B7 */}
        {listing.status === 'active' && (
          <CommunitySection
            listingId={id}
            isGuest={!user}
            canPostLc={
              userProfile?.is_moderator === true ||
              userProfile?.role === 'admin'
            }
          />
        )}
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
