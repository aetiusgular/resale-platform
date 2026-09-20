'use client'

/**
 * The R5B seller-grid overflow control (···), the third square in the BUMP / BOOST row.
 * Shares the listing: the native share sheet where the browser has one, otherwise it copies
 * the link to the clipboard with a brief ✓ confirmation. Sized to match the save-stat square
 * opposite it in the grid above.
 */
import { useState } from 'react'

export default function ShareSquare({ url, className = '' }: { url?: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const href =
      typeof window === 'undefined'
        ? ''
        : url
          ? new URL(url, window.location.origin).href
          : window.location.href
    if (!href) return
    // Native share sheet where available (mobile + desktop Chrome); a dismissed sheet is a no-op.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ url: href }) } catch { /* dismissed */ }
      return
    }
    // Fallback: copy the link, with a short-lived confirmation glyph.
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked (insecure context / denied) */ }
  }

  return (
    <button
      type="button"
      className={`pdp__save-square pdp__owner-more${className ? ' ' + className : ''}`}
      onClick={share}
      aria-label="Share this listing"
      title="Share"
      data-testid="share-listing"
    >
      <span className="pdp__owner-more-glyph" aria-hidden="true">{copied ? '✓' : '···'}</span>
    </button>
  )
}
