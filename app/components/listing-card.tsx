'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { formatCents } from '@/lib/fees'

const TITLE_MAX_CHARS = 38

export function truncateTitle(t: string): string {
  return t.length > TITLE_MAX_CHARS ? t.slice(0, TITLE_MAX_CHARS - 1).trimEnd() + '…' : t
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}H AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D AGO`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks}W AGO`
  return `${Math.floor(days / 30)}M AGO`
}

export type ListingCardData = {
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
  seller: { username: string; id_verification_status: string } | null
  original_price_cents: number | null
  price_display: string
}

type ListingCardProps = {
  listing: ListingCardData
  isSaved: boolean
  onSaveToggle: (id: string, saved: boolean) => void
  /** Override the time label (e.g. "SAVED 2H AGO" instead of "2H AGO") */
  timeLabel?: string
  /** If true, the listing is sold/removed — show veil + dimmed text */
  unavailable?: boolean
}

export default function ListingCard({
  listing, isSaved, onSaveToggle, timeLabel, unavailable,
}: ListingCardProps) {
  const frontImage = listing.images[0] ?? null
  const isVerified = listing.seller?.id_verification_status === 'verified'

  const cardContent = (
    <>
      {/* Image */}
      <div style={{
        position: 'relative',
        aspectRatio: '3/4', boxSizing: 'border-box',
        border: '1px solid var(--color-line)', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-line)',
      }}>
        {frontImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frontImage} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>3 : 4</span>
        )}
        {unavailable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(14,14,13,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>SOLD</span>
          </div>
        )}
      </div>

      {/* Meta — fixed-height lines so cards in same row align pixel-perfect */}
      <div style={{ marginTop: '12px', minHeight: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
        {timeLabel ?? formatTimeAgo(listing.created_at)}
      </div>
      <div
        title={listing.title}
        style={{ marginTop: '4px', minHeight: '20px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', lineHeight: 1.4, color: unavailable ? 'var(--color-ink-soft)' : 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
        data-testid="card-title"
      >
        {truncateTitle(listing.title.toUpperCase())}
      </div>

      {/* Price — strikethrough original if dropped */}
      <div style={{ marginTop: '4px', minHeight: '20px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: unavailable ? 'var(--color-ink-soft)' : 'var(--color-ink)' }}>
        {listing.is_price_dropped && listing.original_price_cents && !unavailable ? (
          <>
            <span style={{ color: 'var(--color-ink-soft)', textDecoration: 'line-through' }}>
              {formatCents(listing.original_price_cents)}
            </span>
            {' '}{listing.price_display}
          </>
        ) : (
          listing.price_display
        )}
      </div>

      <div style={{ marginTop: '4px', minHeight: '18px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
        {listing.size} · {listing.condition_score}/10
      </div>

      {/* VERIFIED badge — always rendered to reserve height; visible only when verified */}
      {!unavailable && (
        <div style={{ marginTop: '8px', minHeight: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
          {isVerified ? 'VERIFIED' : ''}
        </div>
      )}
    </>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', cursor: unavailable ? 'default' : 'pointer',
      outline: '1px solid transparent', outlineOffset: '8px', transition: 'outline-color 120ms linear',
    }}
      onMouseEnter={e => { if (!unavailable) e.currentTarget.style.outlineColor = 'var(--color-line)' }}
      onMouseLeave={e => (e.currentTarget.style.outlineColor = 'transparent')}
    >
      {unavailable ? (
        <div style={{ textDecoration: 'none' }}>
          {cardContent}
        </div>
      ) : (
        <Link href={`/listings/${listing.id}`} style={{ textDecoration: 'none' }}
          onClick={() => trackEvent('product_clicked', { listing_id: listing.id })}
        >
          {cardContent}
        </Link>
      )}

      {/* Save toggle */}
      <button
        onClick={e => { e.preventDefault(); onSaveToggle(listing.id, isSaved) }}
        style={{
          marginTop: '2px', background: 'none', border: 'none', padding: '8px 4px 8px 0',
          fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: isSaved ? 'var(--color-ink)' : 'var(--color-ink-soft)',
          cursor: 'pointer', alignSelf: 'flex-start', transition: 'color 120ms linear',
          minHeight: '44px', boxSizing: 'border-box',
        }}
        data-testid={`save-btn-${listing.id}`}
      >
        {isSaved ? 'SAVED' : 'SAVE'}
      </button>
    </div>
  )
}
