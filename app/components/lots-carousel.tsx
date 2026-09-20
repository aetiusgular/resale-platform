'use client'

/**
 * LotsCarousel — a one-row rail of listing cards ("more lots" under a listing).
 * Scroll-snap track, `--lot-rail-show` cards per view (3.2 desktop · 2.2 ≤960px ·
 * 1.35 ≤720px — the part-card at the edge is the scroll cue), square chevrons that
 * step one card and go inert at either end (hidden ≤960px, where the track swipes).
 * It sits below the fold, so its card images always load lazily.
 *
 * Saving works like the browse grid: optimistic POST/DELETE /api/saves with
 * rollback; a guest gets the sign-in popup naming the item instead of the API.
 * Renders nothing with fewer than two lots — one stray card is not a rail.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import ListingCard, { type ListingCardData } from '@/app/components/listing-card'
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/icons'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { trackEvent } from '@/lib/analytics'

export type LotCard = ListingCardData & { own?: boolean; sold?: boolean }

type Props = {
  listings: LotCard[]
  label: string
  /** Signed-out viewer: the bookmark opens the sign-in popup. */
  isGuest: boolean
  initialSavedIds?: string[]
  showAuthBadge?: boolean
}

export default function LotsCarousel({ listings, label, isGuest, initialSavedIds = [], showAuthBadge = true }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedIds))
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const labelId = useId()

  const syncEdges = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const max = track.scrollWidth - track.clientWidth
    setCanPrev(track.scrollLeft > 1)
    setCanNext(max > 1 && track.scrollLeft < max - 1)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    syncEdges()
    const onScroll = () => syncEdges()
    track.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncEdges)
    ro?.observe(track)
    return () => {
      track.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [listings, syncEdges])

  const step = (dir: -1 | 1) => {
    const track = trackRef.current
    const item = track?.querySelector<HTMLElement>('.lot-rail__item')
    if (!track || !item) return
    const styles = getComputedStyle(track)
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0
    track.scrollBy({ left: dir * (item.offsetWidth + gap) })
  }

  async function toggleSave(listingId: string, currentlySaved: boolean) {
    if (isGuest) {
      const l = listings.find((x) => x.id === listingId)
      openAuthModal(pathname, l ? {
        title: 'SIGN IN TO SAVE',
        cta: 'SIGN IN & SAVE →',
        listing: { brand: l.brand, title: l.title, image: l.images[0] ?? null },
      } : undefined)
      return
    }
    const flip = (on: boolean) => setSavedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(listingId)
      else next.delete(listingId)
      return next
    })
    flip(!currentlySaved) // optimistic
    let ok = false
    try {
      const res = await fetch('/api/saves', {
        method: currentlySaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      })
      ok = res.ok
    } catch { /* offline — fall through to the rollback */ }
    if (!ok) flip(currentlySaved) // rollback
    else if (!currentlySaved) trackEvent('listing_saved', { listing_id: listingId })
  }

  if (listings.length < 2) return null

  return (
    <section className="lot-rail" aria-labelledby={labelId} data-testid="lots-carousel">
      <div className="lot-rail__head">
        <h2 className="lot-rail__label" id={labelId}>{label}</h2>
        <div className="lot-rail__nav">
          <button type="button" className="btn-square" aria-label="Previous lots" disabled={!canPrev} onClick={() => step(-1)}>
            <ChevronLeftIcon size={16} />
          </button>
          <button type="button" className="btn-square" aria-label="Next lots" disabled={!canNext} onClick={() => step(1)}>
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
      <div className="lot-rail__track" ref={trackRef} tabIndex={0} role="group" aria-labelledby={labelId}>
        {listings.map((listing, i) => (
          <div key={listing.id} className="lot-rail__item">
            <ListingCard
              listing={listing}
              isSaved={savedIds.has(listing.id)}
              onSaveToggle={toggleSave}
              position={i}
              own={listing.own}
              unavailable={listing.sold}
              showAuthBadge={showAuthBadge}
              imgLoading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
