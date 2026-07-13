import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { buyerFee, buyerTotal, formatCents } from '@/lib/fees'
import { CONDITION_DEFINITIONS, PHOTO_SLOTS } from '@/lib/condition'
import ConditionPopover from './condition-popover'
import SaveButton from './save-button'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('title, brand, price_cents, images, description')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (!data) return { title: 'Listing not found' }

  const title = `${data.title} — ${data.brand} — ${formatCents(data.price_cents)}`
  const description = `${data.title} by ${data.brand}. ${formatCents(data.price_cents)} on the platform.`
  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : []
  const ogImage = images[0] ?? null

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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

  // Check if current user is admin or seller so they can see non-active listings
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  let isSeller = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  // Fetch the listing
  // No app-level status filter — RLS handles visibility:
  //   anon/auth → active only (listings_public_read_active)
  //   seller    → own listings any status (listings_seller_read_own)
  //   admin     → all (listings_admin_all)
  const { data: listing } = await supabase
    .from('listings')
    .select(`
      id, title, brand, category, size, description,
      condition_score, condition_notes,
      price_cents, saves_count, is_price_dropped,
      images, possession_photo_url,
      status, rejection_reason, created_at,
      seller_id,
      profiles:seller_id (username, role, id_verification_status)
    `)
    .eq('id', id)
    .single()

  if (!listing) notFound()

  isSeller = user?.id === listing.seller_id

  // If non-active and not admin/seller, 404
  if (listing.status !== 'active' && !isAdmin && !isSeller) {
    notFound()
  }

  const images: string[] = Array.isArray(listing.images) ? listing.images : []
  const frontImage = images[0] ?? null
  const seller = (listing.profiles as unknown) as { username: string; role: string; id_verification_status?: string } | null

  const fee     = buyerFee(listing.price_cents)
  const total   = buyerTotal(listing.price_cents)
  const listedAgo = formatTimeAgo(listing.created_at)

  // Check if current user has this listing saved
  let isSaved = false
  if (user) {
    const { data: saveRow } = await supabase
      .from('saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle()
    isSaved = !!saveRow
  }

  // Fetch price history for price-drop display
  let originalPriceCents: number | null = null
  if (listing.is_price_dropped) {
    const { data: firstHistory } = await supabase
      .from('price_history')
      .select('old_price_cents')
      .eq('listing_id', id)
      .order('changed_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    originalPriceCents = firstHistory?.old_price_cents ?? null
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ height: '64px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '32px', padding: '0 80px' }}>
        <Link href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', width: '160px' }}>———</Link>
        <div style={{ flex: 1 }} />
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/sell" style={{ display: 'inline-flex', alignItems: 'center', height: '44px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}>Sell</Link>
        </div>
      </header>

      {/* Seller status banners */}
      {isSeller && listing.status === 'pending_review' && (
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '10px 80px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          REVIEW: PENDING — your listing is in the queue
        </div>
      )}
      {isSeller && listing.status === 'removed' && listing.rejection_reason && (
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-alert)', padding: '10px 80px', fontSize: '13px', color: 'var(--color-alert)' }}>
          Listing rejected: {listing.rejection_reason}
        </div>
      )}
      {isAdmin && listing.status !== 'active' && (
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)', padding: '8px 80px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>ADMIN VIEW · STATUS: {listing.status.toUpperCase()}</span>
          <Link href="/admin/queue" style={{ fontSize: '12px', color: 'var(--color-ink)' }}>← queue</Link>
        </div>
      )}

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 80px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '48px', alignItems: 'start' }}>

          {/* LEFT: Gallery */}
          <div>
            {/* Main image */}
            <div style={{ aspectRatio: '3/4', boxSizing: 'border-box', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {frontImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frontImage} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>3 : 4 — FRONT</span>
              )}
            </div>

            {/* Thumbnails */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '16px' }}>
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
                buyer fee 2% · {formatCents(fee)} — total {formatCents(total)} · that&apos;s it.
              </div>
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
              {listing.status === 'active' && user && !isSeller ? (
                <Link
                  href={`/checkout/${id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}
                >
                  Buy now — {formatCents(total)}
                </Link>
              ) : (
                <button
                  disabled
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
                >
                  {listing.status === 'sold' ? 'SOLD' : listing.status === 'pending_escrow' ? 'PENDING' : 'Buy now'}
                </button>
              )}
              <button
                disabled
                title="offers arrive in B6"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
              >
                Make offer
              </button>
              <button
                disabled
                title="messaging arrives in B6"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid transparent', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'not-allowed', opacity: 0.4 }}
              >
                Message seller
              </button>
            </div>

            {/* Seller block */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-line)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>@{seller?.username ?? '—'}</span>
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
              {user && !isSeller && (
                <SaveButton listingId={id} initialSaved={isSaved} />
              )}
            </div>
          </div>
        </div>

        {/* Community section — B7 placeholder */}
        <div style={{ marginTop: '96px', maxWidth: '840px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: '24px', lineHeight: 1.35, color: 'var(--color-ink)', margin: 0 }}>
            The community weighs in.
          </h2>
          <div style={{ marginTop: '24px', padding: '24px', border: '1px solid var(--color-line)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>
            LEGIT CHECK + COMMENTS — ARRIVES IN B7
          </div>
        </div>
      </div>
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
