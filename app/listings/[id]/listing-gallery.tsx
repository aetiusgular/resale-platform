'use client'

/**
 * Listing gallery: compact 3:4 stage with a left thumb rail (same DOM at every
 * width). Slot 5 (POSSESSION) is proof-of-possession — seller/admin only.
 *
 * ≤720px: swipeable track, count pill, save slot, dots. Thumbs and arrows hide.
 */
import { useRef, useState, type ReactNode } from 'react'

const SLOT_LABELS = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW', 'POSSN']
const isPhoto = (url: string | null) => !!url && !url.startsWith('data:image/svg')

export default function ListingGallery({ images, title, showPossession, saveSlot }: {
  images: string[]
  title: string
  showPossession: boolean
  /** Mobile-only save control, placed top-right on the stage. */
  saveSlot?: ReactNode
}) {
  const slots = SLOT_LABELS.slice(0, showPossession ? 6 : 5).map((label, i) => ({ label, url: images[i] ?? null }))
  const [slot, setSlot] = useState(0)
  const n = slots.length
  const tone = (i: number) => `var(--tone-${(i % 8) + 1})`
  const trackRef = useRef<HTMLDivElement | null>(null)

  // Desktop: arrows / thumbs set the slot and the track follows (it has no overflow
  // there, the scroll is a no-op). Mobile: the swipe sets the slot from scrollLeft.
  const go = (i: number) => {
    setSlot(i)
    const t = trackRef.current
    if (t && t.scrollWidth > t.clientWidth) t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const t = trackRef.current
    if (!t || t.clientWidth === 0) return
    const i = Math.round(t.scrollLeft / t.clientWidth)
    if (i !== slot && i >= 0 && i < n) setSlot(i)
  }

  return (
    <div className="pdp-gallery">
      <div className="pdp-thumbs">
        {slots.map((s, i) => (
          <button key={s.label} type="button" className={`pdp-thumb${i === slot ? ' is-active' : ''}`} onClick={() => go(i)} aria-label={`${s.label} photo`}>
            <span className="pdp-thumb__img" style={{ background: tone(i), overflow: 'hidden' }}>
              {isPhoto(s.url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url!} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="pdp-stage" data-testid="listing-gallery">
        <div className="pdp-stage__track" ref={trackRef} onScroll={onScroll}>
          {slots.map((s, i) => (
            <div key={s.label} className={`pdp-stage__slide${i === slot ? ' is-current' : ''}`} style={{ background: tone(i) }} aria-hidden={i !== slot}>
              {isPhoto(s.url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.url!}
                  alt={`${title} — ${s.label.toLowerCase()}`}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  loading={i === 0 ? undefined : 'lazy'}
                  decoding="async"
                />
              )}
            </div>
          ))}
        </div>
        <button type="button" className="pdp-stage__arrow pdp-stage__arrow--l" aria-label="Previous photo" onClick={() => go((slot + n - 1) % n)}>‹</button>
        <button type="button" className="pdp-stage__arrow pdp-stage__arrow--r" aria-label="Next photo" onClick={() => go((slot + 1) % n)}>›</button>
        <span className="pdp-stage__count">{slot + 1} / {n}</span>
        {saveSlot && <span className="pdp-stage__save">{saveSlot}</span>}
        <span className="pdp-stage__dots" aria-hidden="true">
          {slots.map((s, i) => <span key={s.label} className={`pdp-stage__dot${i === slot ? ' is-on' : ''}`} />)}
        </span>
      </div>
    </div>
  )
}
