'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ListingCard, { type ListingCardData } from '@/app/components/listing-card'
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/icons'

export type LotCard = ListingCardData & { sold?: boolean }

type Props = {
  listings: LotCard[]
  label: string
  hrefBase?: string
  isSaved?: (id: string) => boolean
  onSaveToggle?: (id: string, saved: boolean) => void
}

export default function LotsCarousel({
  listings,
  label,
  hrefBase,
  isSaved,
  onSaveToggle,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [localSaved, setLocalSaved] = useState(() => new Set<string>())

  const savedOf = isSaved ?? ((id: string) => localSaved.has(id))
  const toggleSave = onSaveToggle ?? ((id: string, wasSaved: boolean) => {
    setLocalSaved((prev) => {
      const next = new Set(prev)
      if (wasSaved) next.delete(id)
      else next.add(id)
      return next
    })
  })

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

  if (listings.length < 2) return null

  return (
    <section className="lot-rail" aria-label={label} data-testid="lots-carousel">
      <div className="lot-rail__head">
        <h2 className="lot-rail__label">{label}</h2>
        <div className="lot-rail__nav">
          <button
            type="button"
            className="btn-square"
            aria-label="Previous lots"
            disabled={!canPrev}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="btn-square"
            aria-label="Next lots"
            disabled={!canNext}
            onClick={() => step(1)}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
      <div className="lot-rail__track" ref={trackRef} tabIndex={0}>
        {listings.map((listing, i) => (
          <div key={listing.id} className="lot-rail__item">
            <ListingCard
              listing={listing}
              href={hrefBase ? `${hrefBase}/${listing.id}` : undefined}
              isSaved={savedOf(listing.id)}
              onSaveToggle={toggleSave}
              position={i}
              unavailable={listing.sold}
              showAuthBadge
            />
          </div>
        ))}
      </div>
    </section>
  )
}
