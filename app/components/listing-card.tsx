'use client'

import type { CSSProperties } from 'react'
import PrefetchLink from './prefetch-link'
import { trackEvent } from '@/lib/analytics'
import { formatCents } from '@/lib/fees'
import Icon from './icon'
import ListingImagePlaceholder from './listing-image-placeholder'
import { useStudio } from './studio'

export function truncateTitle(t: string, max = 38): string {
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

/** Quiet relative time — Are.na metadata, not a shout. */
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
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
  authentication_status?: string
  original_price_cents: number | null
  price_display: string
}

type ListingCardProps = {
  listing: ListingCardData
  isSaved: boolean
  onSaveToggle: (id: string, saved: boolean) => void
  /** caption = grid (brand + title + price + facts); record = full accession label */
  density?: 'caption' | 'record'
  /** Footer bookmark — record density only; never on grid */
  showSave?: boolean
  timeLabel?: string
  unavailable?: boolean
  position?: number
  onProductClick?: (id: string) => void
}

const captionPriceStrike: CSSProperties = {
  color: 'var(--color-ink-soft)',
  textDecoration: 'line-through',
  fontWeight: 400,
}

const brandSlot: CSSProperties = {
  minHeight: 'var(--card-slot-brand)',
  maxHeight: 'var(--card-slot-brand)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'lowercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

const titleSlot: CSSProperties = {
  minHeight: 'var(--card-slot-title)',
  maxHeight: 'var(--card-slot-title)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--card-title-size)',
  lineHeight: 'var(--card-line-lh)',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
  minWidth: 0,
}

const priceSlot: CSSProperties = {
  minHeight: 'var(--card-slot-price)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'nowrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--card-title-size)',
  lineHeight: 'var(--card-line-lh)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 0,
}

const factsSlot: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1.4,
  color: 'var(--color-ink-soft)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
  flex: 1,
}

function captionFactsLine(listing: ListingCardData, timeLabel?: string): string {
  const listed = timeLabel ?? formatTimeAgo(listing.created_at)
  const parts = [
    listing.size || null,
    listing.condition_score ? `${listing.condition_score}/10` : null,
    listed ? `listed ${listed}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

function renderPrice(
  listing: ListingCardData,
  unavailable: boolean | undefined,
  strikeStyle: CSSProperties,
) {
  if (listing.is_price_dropped && listing.original_price_cents && !unavailable) {
    return (
      <>
        <span style={strikeStyle}>{formatCents(listing.original_price_cents)}</span>
        <span style={{ marginLeft: '0.4em' }}>{listing.price_display}</span>
      </>
    )
  }
  return listing.price_display
}

export default function ListingCard({
  listing,
  isSaved,
  onSaveToggle,
  density = 'caption',
  showSave: _showSave = false,
  timeLabel,
  unavailable,
  position,
  onProductClick,
}: ListingCardProps) {
  const studio = useStudio()
  const frontImage = listing.images[0] ?? null
  const isVerified = listing.seller?.id_verification_status === 'verified'
  const isAuthed = listing.authentication_status === 'authenticated'
  const showTrust = !unavailable && (isAuthed || isVerified)
  const isCaption = density === 'caption'
  const frameBorder = isCaption ? 'none' : studio.frame === 'none' ? 'none' : '1px solid var(--color-line)'
  const framePad = !isCaption && studio.frame === 'inset' ? 8 : 0
  const accession = timeLabel ?? formatTimeAgo(listing.created_at)
  const factParts = [
    listing.size || null,
    `${listing.condition_score}/10`,
  ].filter(Boolean)
  const ink = unavailable ? 'var(--color-ink-soft)' : 'var(--color-ink)'
  const mark = studio.iconSize + 2
  const factsLine = captionFactsLine(listing, timeLabel)

  const cardContent = (
    <>
      <div
        className={`listing-card-image${isCaption ? ' listing-card-image--caption' : ''}`}
        style={{
          border: frameBorder,
          padding: framePad,
        }}
      >
        {frontImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frontImage}
            alt={listing.title}
            loading={(position ?? 0) < 8 ? 'eager' : 'lazy'}
            decoding="async"
            className="listing-card-photo"
            style={{ width: '100%', height: '100%', objectFit: studio.imageFit }}
          />
        ) : (
          <ListingImagePlaceholder />
        )}
        {!isCaption && !unavailable && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onSaveToggle(listing.id, isSaved) }}
            aria-label={isSaved ? 'saved' : 'save'}
            aria-pressed={isSaved}
            className="card-save card-save-overlay"
            data-testid={`save-btn-${listing.id}`}
          >
            <span aria-hidden className="card-save-overlay-hit" />
            <Icon name="save" weight={isSaved ? 'fill' : studio.iconWeight} size={mark} />
          </button>
        )}
        {unavailable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--color-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)' }}>sold</span>
          </div>
        )}
      </div>

      {isCaption ? (
        <div className="listing-card-caption">
          <div
            className="listing-card-caption-brand"
            style={{ color: listing.brand ? ink : 'transparent' }}
            data-testid="card-brand"
          >
            {listing.brand || '\u00a0'}
          </div>
          <div
            className="listing-card-caption-title"
            title={listing.title}
            style={{ color: ink }}
            data-testid="card-title"
          >
            {truncateTitle(listing.title)}
          </div>
          <div className="listing-card-caption-price" style={{ color: ink }} data-testid="card-price">
            {renderPrice(listing, unavailable, captionPriceStrike)}
          </div>
          {factsLine && (
            <div className="listing-card-caption-facts" data-testid="card-facts">
              {factsLine}
            </div>
          )}
        </div>
      ) : (
        <div className="listing-card-label">
          <div
            style={{ ...brandSlot, color: listing.brand ? ink : 'transparent' }}
            data-testid="card-brand"
          >
            {listing.brand || '\u00a0'}
          </div>

          <div
            title={listing.title}
            style={{
              ...titleSlot,
              marginTop: 4,
              fontWeight: studio.titleWeight,
              color: ink,
            }}
            data-testid="card-title"
          >
            {truncateTitle(listing.title)}
          </div>

          <div style={{ ...priceSlot, color: ink }} data-testid="card-price">
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listing.is_price_dropped && listing.original_price_cents && !unavailable ? (
                <>
                  <span style={{ color: 'var(--color-ink-soft)', textDecoration: 'line-through' }}>
                    {formatCents(listing.original_price_cents)}
                  </span>
                  <span style={{ marginLeft: '0.4em' }}>{listing.price_display}</span>
                </>
              ) : (
                listing.price_display
              )}
            </span>
            {showTrust && studio.showFact && (
              isAuthed ? (
                <span
                  title="Authenticated listing"
                  style={{ display: 'inline-flex', alignItems: 'center', flex: 'none', color: ink }}
                  data-testid="card-trust"
                >
                  <Icon name="verified" size={18} label="Authenticated listing" />
                </span>
              ) : (
                <span
                  title="Seller ID verified"
                  aria-label="Seller ID verified"
                  data-testid="card-trust"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-ink-soft)',
                    flex: 'none',
                    display: 'inline-block',
                  }}
                />
              )
            )}
          </div>

          <div className="listing-card-price-rule" aria-hidden />

          <div className="listing-card-footer">
            <span style={factsSlot} data-testid="card-facts">
              {factParts.join(' / ')}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.4,
                letterSpacing: '-0.01em',
                color: 'var(--color-ink-soft)',
                whiteSpace: 'nowrap',
                flex: 'none',
              }}
              data-testid="card-time"
            >
              {accession}
            </span>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', cursor: unavailable ? 'default' : 'pointer' }}
      data-recs-item-id={listing.id}
      data-recs-pos={position ?? 0}
    >
      {unavailable ? (
        <div style={{ textDecoration: 'none' }}>{cardContent}</div>
      ) : (
        <PrefetchLink
          href={`/listings/${listing.id}`}
          style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', minWidth: 0 }}
          onClick={() => { trackEvent('product_clicked', { listing_id: listing.id }); onProductClick?.(listing.id) }}
        >
          {cardContent}
        </PrefetchLink>
      )}
    </div>
  )
}
