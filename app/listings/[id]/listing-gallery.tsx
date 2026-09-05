'use client'

/**
 * Listing gallery (design option 4A): 3:4 stage with prev/next arrows and a
 * counter, slot thumbnails below (FRONT / BACK / TAG / DETAIL / FLAW / POSSN).
 * Slot 5 (POSSESSION) is proof-of-possession — shown to the seller/admin only;
 * public viewers get the five listing photos.
 */
import { useState } from 'react'

const SLOT_LABELS = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW', 'POSSN']

export default function ListingGallery({ images, title, showPossession }: { images: string[]; title: string; showPossession: boolean }) {
  const slots = SLOT_LABELS.slice(0, showPossession ? 6 : 5).map((label, i) => ({ label, url: images[i] ?? null }))
  const [slot, setSlot] = useState(0)
  const n = slots.length
  const current = slots[slot] ?? slots[0]
  const tone = (i: number) => `var(--tone-${(i % 8) + 1})`

  return (
    <>
      <div className="pdp-stage" style={{ background: tone(slot) }}>
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={`${title} — ${current.label.toLowerCase()}`}
            fetchPriority={slot === 0 ? 'high' : undefined}
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span className="pdp-stage__label">{current.label}</span>
        )}
        <button type="button" className="pdp-stage__arrow pdp-stage__arrow--l" aria-label="Previous photo" onClick={() => setSlot((s) => (s + n - 1) % n)}>‹</button>
        <button type="button" className="pdp-stage__arrow pdp-stage__arrow--r" aria-label="Next photo" onClick={() => setSlot((s) => (s + 1) % n)}>›</button>
        <span className="pdp-stage__count">{slot + 1} / {n}</span>
      </div>
      <div className="pdp-thumbs" style={n === 5 ? { gridTemplateColumns: 'repeat(5, 1fr)' } : undefined}>
        {slots.map((s, i) => (
          <button key={s.label} type="button" className={`pdp-thumb${i === slot ? ' is-active' : ''}`} onClick={() => setSlot(i)} aria-label={`${s.label} photo`}>
            <span className="pdp-thumb__img" style={{ background: tone(i), overflow: 'hidden' }}>
              {s.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </span>
            <span className="pdp-thumb__label">{s.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
