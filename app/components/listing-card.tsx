'use client'

/**
 * ListingCard — the most reused element (browse, saved, seller profile, sell).
 * Design: 3:4 media with flags (BOOSTED / ✓ AUTH / YOURS / PRICE DROP), SOLD
 * veil, brand-first caption row with size + bookmark, title, price row with the
 * struck original price and a mono timestamp (or BUMP for the viewer's own
 * listing). The whole card is a real <a href> to /listings/[id] (SEO crawl graph).
 */
import PrefetchLink from './prefetch-link'
import { HeartIcon, XIcon } from './icons'
import { trackEvent } from '@/lib/analytics'
import { formatCents } from '@/lib/fees'

import { truncateTitle, formatTimeAgo } from './format'

// Re-exported for client callers (saved, sell catalog). Server components must
// import these from './format' directly — see the note there.
export { truncateTitle, formatTimeAgo }

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
  /** Paid boost active — BOOSTED flag */
  promoted?: boolean
}

type ListingCardProps = {
  listing: ListingCardData
  isSaved: boolean
  onSaveToggle: (id: string, saved: boolean) => void
  /** Override the time label (e.g. "SAVED 2D AGO" instead of "2D AGO") */
  timeLabel?: string
  /** If true, the listing is sold/removed — SOLD veil + dimmed text */
  unavailable?: boolean
  /** The viewer's own listing — YOURS flag, no save control */
  own?: boolean
  /** Saved page: × control that removes the item instead of the bookmark */
  onRemove?: (id: string) => void
  /** recs telemetry: grid position (0-based) for impression/click events */
  position?: number
  /** recs telemetry: called on product click, alongside PostHog product_clicked */
  onProductClick?: (id: string) => void
  /** Show AUTHENTICATED flag when the item passed authentication (flag-gated by caller) */
  showAuthBadge?: boolean
  /** Own listing: BUMP ↗ action (reference 16A). Without it the row links to /sell. */
  onBump?: (id: string) => void
  /** Own listing already bumped this session → "BUMPED ✓" */
  bumped?: boolean
}

export default function ListingCard({
  listing, isSaved, onSaveToggle, timeLabel, unavailable, own, onRemove, position, onProductClick, showAuthBadge = true, onBump, bumped,
}: ListingCardProps) {
  const frontImage = listing.images[0] ?? null
  const authenticated = showAuthBadge && listing.authentication_status === 'authenticated'
  const tone = ((position ?? listing.id.charCodeAt(0)) % 8) + 1
  const flag = listing.promoted && !unavailable
    ? { cls: 'flag--boost', text: 'BOOSTED' }
    : own
      ? { cls: 'flag--tag', text: 'YOURS' }
      : authenticated
        ? { cls: 'flag--tag', text: '✓ AUTH' }
        : listing.is_price_dropped && listing.original_price_cents && !unavailable
          ? { cls: 'flag--tag', text: 'PRICE DROP' }
          : null

  return (
    <article
      className="card"
      data-recs-item-id={listing.id}
      data-recs-pos={position ?? 0}
      data-testid="listing-card"
    >
      <PrefetchLink
        href={`/listings/${listing.id}`}
        onClick={() => { trackEvent('product_clicked', { listing_id: listing.id }); onProductClick?.(listing.id) }}
        aria-label={`${listing.brand} — ${listing.title}`}
      >
        <div className="card__media" style={{ background: `var(--tone-${tone})` }}>
          {frontImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frontImage}
              alt={listing.title}
              // First two grid rows load eagerly; the rest wait until scrolled near.
              loading={(position ?? 0) < 8 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="card__slot">FRONT</span>
          )}
          {flag && <span className={`flag ${flag.cls}`}>{flag.text}</span>}
          {unavailable && (
            <span className="card__sold"><span>SOLD</span></span>
          )}
        </div>
      </PrefetchLink>

      {onRemove && (
        <button
          type="button"
          className="card__unsave"
          title="Unsave"
          aria-label={`Unsave ${listing.title}`}
          onClick={() => onRemove(listing.id)}
          data-testid={`save-btn-${listing.id}`}
        >
          <XIcon size={9} />
        </button>
      )}

      <div className="card__row1">
        <PrefetchLink href={`/listings/${listing.id}`} className="card__brand" title={listing.brand}>
          {listing.brand.toUpperCase()}
        </PrefetchLink>
        <span className="card__meta">
          <span className="card__size">{listing.size}</span>
          {!own && !onRemove && (
            <button
              type="button"
              className={`card__save${isSaved ? ' is-saved' : ''}`}
              aria-label={isSaved ? 'Remove from saved' : 'Save item'}
              aria-pressed={isSaved}
              onClick={() => onSaveToggle(listing.id, isSaved)}
              data-testid={`save-btn-${listing.id}`}
            >
              <HeartIcon filled={isSaved} size={18} />
            </button>
          )}
          {/* Saved page ≤720px (mobile-web 06): the filled bookmark in the caption row unsaves;
              the × on the image is the desktop control. */}
          {onRemove && (
            <button
              type="button"
              className="card__save card__save--m is-saved"
              aria-label={`Unsave ${listing.title}`}
              onClick={() => onRemove(listing.id)}
            >
              <HeartIcon filled size={18} />
            </button>
          )}
        </span>
      </div>
      <div className="card__title" title={listing.title} data-testid="card-title">
        {truncateTitle(listing.title)}
      </div>
      <div className="card__row2">
        <span className="card__prices">
          {listing.is_price_dropped && listing.original_price_cents && !unavailable && (
            <span className="card__old">{formatCents(listing.original_price_cents)}</span>
          )}
          <span className="card__price" style={unavailable ? { color: 'var(--faint)' } : undefined}>{listing.price_display}</span>
        </span>
        {own && !unavailable ? (
          onBump ? (
            <button type="button" className="card__bump" onClick={() => onBump(listing.id)} disabled={bumped} aria-label={`Bump ${listing.title}`}>
              {bumped ? 'BUMPED ✓' : 'BUMP ↗'}
            </button>
          ) : (
            <PrefetchLink href="/sell" className="card__bump">BUMP ↗</PrefetchLink>
          )
        ) : (
          <span className="card__time">{timeLabel ?? formatTimeAgo(listing.created_at)}</span>
        )}
      </div>
    </article>
  )
}
