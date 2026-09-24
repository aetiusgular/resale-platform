'use client'

/**
 * Listing description with the R5B long-copy handling.
 *
 * In flow the description fills the space left in the rail (flex:1) and clips to an excerpt; a
 * long one shows "READ FULL DESCRIPTION → / N WORDS". Because it flex-grows, the Measurements
 * block below it is pinned to the bottom of the rail (the photo's bottom line) on every listing,
 * and a short description just leaves air in the description window.
 *
 * READ FULL flips the rail into a reading pane IN PLACE (R5B "open"): a head (DESCRIPTION / N
 * WORDS + close), a "BRAND · TITLE · SPEC" line with Message seller, a scrollable body of the
 * full text, and a dock (price + BUY NOW / MAKE OFFER). Desktop: the pane covers the rail
 * (portalled into .pdp__right). ≤960px: a full-screen sheet, the same takeover as the filters.
 * Close returns. The swap is a crossfade (safe under prefers-reduced-motion).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@/app/components/icons'

export default function ListingDescription({
  text, brand, title, spec, priceDisplay, shipDisplay, buyNode, offerNode, messageNode,
}: {
  text: string
  brand: string
  title: string
  spec: string
  priceDisplay: string
  /** Full shipping headline, e.g. "+ $17 SHIPPING US" or "SHIPS FROM JAPAN". */
  shipDisplay: string
  /** Dock BUY NOW control (server-composed: link / guest gate / disabled). */
  buyNode?: ReactNode
  /** Dock MAKE OFFER control. */
  offerNode?: ReactNode
  /** Message seller control shown on the pane's piece line. */
  messageNode?: ReactNode
}) {
  const body = (text ?? '').trim()
  const [open, setOpen] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const [rail, setRail] = useState<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const excerptRef = useRef<HTMLDivElement | null>(null)
  const words = body ? body.split(/\s+/).length : 0

  // The pane portals into the rail (.pdp__right) so it covers the whole placard, not just the
  // clipped description box. Resolved from the DOM after mount.
  useEffect(() => { setRail(rootRef.current?.closest('.pdp__right') as HTMLElement | null) }, [])

  // Overflow is measured on the clip box; re-measured on width/height changes. Not while open.
  useEffect(() => {
    if (open) return
    const el = excerptRef.current
    if (!el) return
    const measure = () => setOverflowing(el.scrollHeight - el.clientHeight > 2)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [body, open])

  // Lock body scroll + close on Escape while the pane is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open])

  const pane = open && rail ? createPortal(
    <div className="pdp-reader" role="dialog" aria-modal="true" aria-label="Full description" data-testid="desc-reader">
      <div className="pdp-reader__head">
        <span className="pdp-reader__title">DESCRIPTION<span className="pdp-reader__words">{words} WORDS</span></span>
        <button type="button" className="pdp-reader__close" aria-label="Close full description" onClick={() => setOpen(false)} data-testid="desc-reader-close">
          <XIcon size={16} />
        </button>
      </div>
      <div className="pdp-reader__piece">
        <span className="pdp-reader__piece-text">{[brand, title, spec].filter(Boolean).join(' · ').toUpperCase()}</span>
        {messageNode}
      </div>
      <div className="pdp-reader__body" tabIndex={0}>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{text}</p>
      </div>
      {(buyNode || offerNode) && (
        <div className="pdp-reader__dock">
          <span className="pdp-reader__price">{priceDisplay}<span className="pdp-reader__ship">{shipDisplay}</span></span>
          <div className="pdp-reader__actions">{buyNode}{offerNode}</div>
        </div>
      )}
    </div>,
    rail,
  ) : null

  return (
    <div className="pdp__desc" data-testid="listing-description" ref={rootRef}>
      <div className="field-label field-label--row"><span>DESCRIPTION</span></div>
      {body && (
        <div className="pdp__desc-excerpt" ref={excerptRef}>
          <p className="pdp__desc-body">{text}</p>
        </div>
      )}
      {overflowing && (
        <button type="button" className="pdp__desc-toggle" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="desc-toggle">
          <span className="pdp__desc-more">READ FULL DESCRIPTION →</span>
          <span className="pdp__desc-words">{words} WORDS</span>
        </button>
      )}
      {pane}
    </div>
  )
}
