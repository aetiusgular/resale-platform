'use client'

/**
 * Listing gallery: 3:4 stage + chevron controls + unlabeled thumb strip.
 * Layout is Dialkit-driven via html[data-gallery] (under-flush default).
 * Slot names stay in aria-label only. Slot 5 (POSSESSION) is seller/admin only.
 *
 * Same DOM at every width. Mobile keeps the swipe track; under variants keep
 * the strip on the first screen. Stage-only hides thumbs in CSS.
 */
import { useRef, useState, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/icons'

const SLOT_LABELS = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW', 'POSSN']

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
      <button type="button" className="pdp-arrow pdp-arrow--l" aria-label="Previous photo" onClick={() => go((slot + n - 1) % n)}>
        <ChevronLeftIcon />
      </button>
      <div className="pdp-stage" data-testid="listing-gallery">
        <div className="pdp-stage__track" ref={trackRef} onScroll={onScroll}>
          {slots.map((s, i) => (
            <div key={s.label} className={`pdp-stage__slide${i === slot ? ' is-current' : ''}`} style={{ background: tone(i) }} aria-hidden={i !== slot}>
              {s.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.url}
                  alt={`${title} — ${s.label.toLowerCase()}`}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  loading={i === 0 ? undefined : 'lazy'}
                  decoding="async"
                />
              ) : null}
            </div>
          ))}
        </div>
        <span className="pdp-stage__count">{slot + 1} / {n}</span>
        {saveSlot && <span className="pdp-stage__save">{saveSlot}</span>}
        <span className="pdp-stage__dots" aria-hidden="true">
          {slots.map((s, i) => <span key={s.label} className={`pdp-stage__dot${i === slot ? ' is-on' : ''}`} />)}
        </span>
      </div>
      <button type="button" className="pdp-arrow pdp-arrow--r" aria-label="Next photo" onClick={() => go((slot + 1) % n)}>
        <ChevronRightIcon />
      </button>
      <div className="pdp-thumbs">
        {slots.map((s, i) => (
          <button key={s.label} type="button" className={`pdp-thumb${i === slot ? ' is-active' : ''}`} onClick={() => go(i)} aria-label={`${s.label} photo`}>
            <span className="pdp-thumb__img" style={{ background: tone(i) }}>
              {s.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" loading="lazy" decoding="async" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
