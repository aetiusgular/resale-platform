'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { SavedListing } from './page'
import ListingCard, { formatTimeAgo } from '@/app/components/listing-card'
import { formatCents } from '@/lib/fees'

type Props = {
  listings: SavedListing[]
}

function savedTimeLabel(savedAt: string): string {
  return `saved ${formatTimeAgo(savedAt)}`
}

function soldTimeLabel(createdAt: string): string {
  return `sold ${formatTimeAgo(createdAt)}`
}

export default function SavedClient({ listings: initialListings }: Props) {
  const [listings, setListings] = useState(initialListings)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const activeListings = listings.filter(l => l.status === 'active')
  const soldListings = listings.filter(l => l.status !== 'active')
  const allVisible = listings.filter(l => !removingIds.has(l.id))
  const priceDropCount = activeListings.filter(l => l.is_price_dropped && l.original_price_cents && l.original_price_cents > l.price_cents).length

  const handleUnsave = useCallback(async (listingId: string) => {
    // Optimistic remove
    setRemovingIds(prev => new Set(prev).add(listingId))

    try {
      const res = await fetch('/api/saves', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      })
      if (res.ok) {
        setListings(prev => prev.filter(l => l.id !== listingId))
        setRemovingIds(prev => { const s = new Set(prev); s.delete(listingId); return s })
      } else {
        // Revert
        setRemovingIds(prev => { const s = new Set(prev); s.delete(listingId); return s })
      }
    } catch {
      setRemovingIds(prev => { const s = new Set(prev); s.delete(listingId); return s })
    }
  }, [])

  const handleClearSold = useCallback(async () => {
    const soldIds = soldListings.map(l => l.id)
    setRemovingIds(prev => {
      const s = new Set(prev)
      for (const id of soldIds) s.add(id)
      return s
    })

    for (const id of soldIds) {
      try {
        await fetch('/api/saves', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: id }),
        })
      } catch { /* best-effort */ }
    }
    setListings(prev => prev.filter(l => l.status === 'active'))
    setRemovingIds(new Set())
  }, [soldListings])

  // Empty state
  if (allVisible.length === 0 && listings.length === 0) {
    return (
      <div className="page-inset" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <h1 style={{ font: '300 28px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0, padding: '48px 0 24px' }}>Saved</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--color-line)' }}>
          <TabItem label="Items" count={0} active />
          <TabItem label="Searches" count={0} />
          <TabItem label="Sellers" count={0} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0 96px', textAlign: 'center' }}>
          <span style={{ font: '300 22px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Nothing saved yet.</span>
          <span style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink-soft)', maxWidth: '320px' }}>
            Listings you save are kept here, with any price changes noted.
          </span>
          <Link
            href="/browse"
            style={{
              marginTop: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              whiteSpace: 'nowrap', height: '44px', padding: '0 32px',
              background: 'var(--color-bg)', color: 'var(--color-ink)',
              border: '1px solid var(--color-ink)', borderRadius: '2px',
              font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
              textDecoration: 'none',
            }}
          >
            Browse listings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-inset" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <h1 style={{ font: '300 28px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0, padding: '48px 0 24px' }}>Saved</h1>

      {/* Tabs */}
        <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--color-line)' }}>
        <TabItem label="Items" count={allVisible.length} active />
        <TabItem label="Searches" count={0} />
        <TabItem label="Sellers" count={0} />
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '20px 0 32px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          {allVisible.length} ITEMS{priceDropCount > 0 ? `, ${priceDropCount} PRICE DROP${priceDropCount > 1 ? 'S' : ''}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {soldListings.length > 0 && (
            <button
              onClick={handleClearSold}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--color-ink-soft)', textDecoration: 'underline',
                textDecorationThickness: '1px', textUnderlineOffset: '3px',
              }}
            >
              Clear sold ({soldListings.length})
            </button>
          )}
          <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
            Sort: Recently saved <span style={{ color: 'var(--color-ink-soft)', fontSize: '10px' }}>▾</span>
          </span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="saved-items-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '40px 24px', paddingBottom: '8px' }}
        data-testid="saved-items-grid"
      >
        {allVisible.map(listing => {
          if (removingIds.has(listing.id)) return null
          const isUnavailable = listing.status !== 'active'
          const priceDrop = !isUnavailable && listing.price_at_save && listing.price_at_save > listing.price_cents
            ? listing.price_at_save - listing.price_cents
            : null

          return (
            <div key={listing.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <SavedCard
                listing={listing}
                unavailable={isUnavailable}
                timeLabel={isUnavailable ? soldTimeLabel(listing.created_at) : savedTimeLabel(listing.saved_at)}
                priceDrop={priceDrop}
                onRemove={() => handleUnsave(listing.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabItem({ label, count, active }: { label: string; count: number; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '12px 0 14px',
      ...(active ? { marginBottom: '-1px', borderBottom: '1px solid var(--color-accent)' } : {}),
      font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: active ? 'var(--color-accent)' : 'var(--color-ink-soft)',
      cursor: 'pointer', minHeight: '44px', boxSizing: 'border-box',
    }}>
      {label}<span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{count}</span>
    </span>
  )
}

function SavedCard({
  listing, unavailable, timeLabel, priceDrop, onRemove,
}: {
  listing: SavedListing
  unavailable: boolean
  timeLabel: string
  priceDrop: number | null
  onRemove: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <ListingCard
        listing={listing}
        isSaved={true}
        onSaveToggle={() => onRemove()}
        showSave
        timeLabel={timeLabel}
        unavailable={unavailable}
      />
      {/* Price drop flag */}
      {priceDrop && priceDrop > 0 && (
        <div style={{
          marginTop: '8px', fontFamily: 'var(--font-mono)', fontWeight: 700,
          fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink)',
        }}>
          ↓ {formatCents(priceDrop)} SINCE SAVED
        </div>
      )}
      {/* Find similar for sold items */}
      {unavailable && (
        <Link
          href="/browse"
          style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-ink)', alignSelf: 'flex-start' }}
        >
          Find similar →
        </Link>
      )}
      {/* Remove × button on image */}
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        data-testid={`unsave-${listing.id}`}
        style={{
          position: 'absolute', top: '4px', right: '4px',
          width: '40px', height: '40px', boxSizing: 'border-box',
          background: 'var(--color-bg)', border: '1px solid var(--color-line)',
          borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', color: 'var(--color-ink-soft)', cursor: 'pointer',
          zIndex: 1,
        }}
        aria-label={`Remove ${listing.title} from saved`}
      >
        ×
      </button>
    </div>
  )
}
