'use client'

/**
 * Listing gallery: a 3:4 stage with a thumb rail (`.pdp-gallery` grid), boxed chevrons
 * and an "n / N" counter. The current thumb carries an ink underline. Photos are the
 * seller's ordered public photos — the first is the cover — with no per-slot names;
 * alt text and aria-labels say "cover" / "photo 2" / "possession".
 *
 * Every photo renders as a slot (up to 15 public ones, plus the seller's possession proof
 * for the seller/admin view). A listing with no photos at all (a seed row) still gets one
 * tone placeholder so the stage, the counter and the chevrons render. The rail is fixed
 * pitch and scrolls inside the stage height past ~8 thumbs, keeping the active thumb in
 * view. page.tsx sends non-seller viewers only the public photos, so the proof-of-
 * possession photo never reaches a buyer here.
 *
 * Pressing the displayed photo opens a full-screen viewer (`.pdp-lightbox`, a --bg
 * takeover with an X, edge chevrons and a counter) on both mobile and desktop.
 * Keyboard: ← / → move between photos anywhere on the post (never while typing in a
 * field); in the viewer they page and Escape closes it.
 *
 * ≤960px the stage becomes one swipeable scroll-snap track with the counter top-left
 * and the save bookmark top-right (`saveSlot`); the chevrons and thumb rail hide
 * there and the dots on the stage become the position marker. >960px shows the rail.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/app/components/icons'
import { MAX_PHOTOS, photoLabel } from '@/lib/listings/images'

/** Up to MAX_PHOTOS public photos, plus the seller's possession proof. */
const MAX_SLOTS = MAX_PHOTOS + 1

export default function ListingGallery({ images, title, possession, saveSlot, legitSlot }: {
  /** The seller's public photos in order; the first is the cover. */
  images: string[]
  title: string
  /** Proof-of-possession photo — only ever passed for the seller/admin view. */
  possession?: string | null
  /** Mobile-only save control, placed top-right on the stage. */
  saveSlot?: ReactNode
  /** Legit-check badge, placed top-left on the stage (desktop). */
  legitSlot?: ReactNode
}) {
  // One slot per photo; a listing with none still gets a single tone placeholder so the
  // stage renders. The possession proof, when shown, is the last slot.
  const photos = images.slice(0, MAX_PHOTOS)
  const all: string[] = possession ? [...photos, possession] : photos
  const n = Math.min(MAX_SLOTS, Math.max(1, all.length))
  const slots: Array<string | null> = Array.from({ length: n }, (_, i) => all[i] || null)
  const possessionAt = possession ? all.length - 1 : -1
  const [slot, setSlot] = useState(0)
  const [zoom, setZoom] = useState(false)
  const cur = Math.min(slot, n - 1)
  const tone = (i: number) => `var(--tone-${(i % 8) + 1})`
  const labelFor = (i: number) => (i === possessionAt ? 'possession' : photoLabel(i))
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbsRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  // A programmatic scroll (thumb tap on the swipe track) passes every slide on its way;
  // without this the underline, the counter and aria-current flicker through all of them.
  const targetRef = useRef<number | null>(null)

  // Move to slot i (wraps). Desktop: chevrons/thumbs set the slot and the track follows
  // (no overflow there, the scroll is a no-op). Mobile: the swipe sets the slot from scrollLeft.
  const go = useCallback((i: number) => {
    const next = (i % n + n) % n
    setSlot(next)
    const t = trackRef.current
    if (t && t.scrollWidth > t.clientWidth) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      targetRef.current = still ? null : next
      t.scrollTo({ left: next * t.clientWidth, behavior: still ? 'auto' : 'smooth' })
    }
  }, [n])

  const onScroll = () => {
    const t = trackRef.current
    if (!t || t.clientWidth === 0) return
    const i = Math.round(t.scrollLeft / t.clientWidth)
    if (targetRef.current !== null) {
      if (i === targetRef.current) targetRef.current = null
      return
    }
    if (i !== cur && i >= 0 && i < n) setSlot(i)
  }
  // A finger on the track takes over from any scroll still in flight.
  const release = () => { targetRef.current = null }

  // ← / → anywhere on the post (not while typing); Escape closes the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1) }
      else if (e.key === 'Escape' && zoom) { e.preventDefault(); setZoom(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, cur, zoom])

  // Keep the active thumb in view as the slot changes (the desktop scroll strip).
  useEffect(() => {
    const strip = thumbsRef.current
    const active = strip?.children[cur] as HTMLElement | undefined
    if (!strip || !active) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [cur])

  // Lock body scroll while the viewer is open.
  useEffect(() => {
    if (!zoom) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [zoom])

  // Only expand a slot that actually holds a photo (an empty placeholder has nothing to show).
  const openZoom = () => { if (slots[cur]) setZoom(true) }
  const closeZoom = () => { setZoom(false); stageRef.current?.focus() }

  return (
    <div className="pdp-gallery">
      <div
        className="pdp-stage"
        data-testid="listing-gallery"
        ref={stageRef}
        role="button"
        tabIndex={0}
        aria-label="Expand photo to full screen"
        onClick={openZoom}
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom() } }}
      >
        <div className="pdp-stage__track" ref={trackRef} onScroll={onScroll} onTouchStart={release} onPointerDown={release}>
          {slots.map((url, i) => (
            <div key={i} className={`pdp-stage__slide${i === cur ? ' is-current' : ''}`} style={{ background: tone(i) }} aria-hidden={i !== cur}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`${title} — ${labelFor(i)}`}
                  fetchPriority={i === 0 ? 'high' : undefined}
                  loading={i === 0 ? undefined : 'lazy'}
                  decoding="async"
                />
              ) : null}
            </div>
          ))}
        </div>
        <span className="pdp-stage__count">{cur + 1} / {n}</span>
        {saveSlot && <span className="pdp-stage__save" onClick={(e) => e.stopPropagation()}>{saveSlot}</span>}
        {/* Legit-check badge — top-left over the photo (B2). stopPropagation so it jumps to the thread, not the lightbox. */}
        {legitSlot && <span className="pdp-stage__legit" onClick={(e) => e.stopPropagation()}>{legitSlot}</span>}
        {/* Position dots on the stage — the ≤960 (swipe) indicator; the thumb strip is the desktop one. */}
        <span className="pdp-stage__dots" aria-hidden="true">
          {slots.map((_, i) => <span key={i} className={`pdp-stage__dot${i === cur ? ' is-on' : ''}`} />)}
        </span>
        {/* Prev/next overlay the photo and appear only on hover of the stage (or on keyboard focus).
            stopPropagation so an arrow click pages instead of opening the full-screen viewer. */}
        <button type="button" className="pdp-arrow pdp-arrow--l" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(cur - 1) }}>
          <ChevronLeftIcon />
        </button>
        <button type="button" className="pdp-arrow pdp-arrow--r" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(cur + 1) }}>
          <ChevronRightIcon />
        </button>
      </div>
      <div className="pdp-thumbs" ref={thumbsRef}>
        {slots.map((url, i) => (
          <button key={i} type="button" className={`pdp-thumb${i === cur ? ' is-active' : ''}`} onClick={() => go(i)} aria-label={`${labelFor(i).charAt(0).toUpperCase()}${labelFor(i).slice(1)} photo`} aria-current={i === cur ? 'true' : undefined}>
            <span className="pdp-thumb__img" style={{ background: tone(i) }}>
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" loading="lazy" decoding="async" />
              )}
            </span>
          </button>
        ))}
      </div>
      {zoom && (
        <Lightbox slots={slots} slot={cur} n={n} alt={`${title} — ${labelFor(cur)}`} tone={tone} onGo={go} onClose={closeZoom} />
      )}
    </div>
  )
}

/**
 * Full-screen viewer — a --bg takeover (the same full-bleed pattern as the mobile
 * filter sheet), portalled to <body> so no ancestor overflow clips it. The backdrop
 * closes it; the photo and controls do not. Paging and Escape are handled by the
 * gallery's document listener, which stays mounted underneath. An empty slot shows
 * its tone placeholder, matching the carousel.
 */
function Lightbox({ slots, slot, n, alt, tone, onGo, onClose }: {
  slots: Array<string | null>
  slot: number
  n: number
  alt: string
  tone: (i: number) => string
  onGo: (i: number) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  if (typeof document === 'undefined') return null
  const url = slots[slot]
  return createPortal(
    <div className="pdp-lightbox" role="dialog" aria-modal="true" aria-label={`${alt} (${slot + 1} of ${n})`} onClick={onClose} data-testid="lightbox">
      <button ref={closeRef} type="button" className="pdp-lightbox__close" aria-label="Close full screen" onClick={onClose} data-testid="lightbox-close">
        <XIcon size={16} />
      </button>
      <button type="button" className="pdp-lightbox__arrow pdp-lightbox__arrow--l" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); onGo(slot - 1) }}>
        <ChevronLeftIcon size={20} />
      </button>
      <div className="pdp-lightbox__stage" onClick={(e) => e.stopPropagation()}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} decoding="async" />
        ) : (
          <span className="pdp-lightbox__blank" style={{ background: tone(slot) }} aria-hidden="true" />
        )}
      </div>
      <button type="button" className="pdp-lightbox__arrow pdp-lightbox__arrow--r" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); onGo(slot + 1) }}>
        <ChevronRightIcon size={20} />
      </button>
      <span className="pdp-lightbox__count">{slot + 1} / {n}</span>
    </div>,
    document.body,
  )
}
