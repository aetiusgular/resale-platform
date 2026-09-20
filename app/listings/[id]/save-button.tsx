'use client'

/**
 * Listing-page save control — the bookmark beside the brand on desktop and on the
 * gallery stage ≤960px. Optimistic; guests get the sign-in popup instead of the API —
 * dressed as the save gate (mobile-web 25) when the listing is passed in.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { HeartIcon } from '@/app/components/icons'

export default function SaveButton({
  listingId,
  initialSaved,
  guest = false,
  listing,
  className = 'btn-square',
  iconSize = 18,
  count,
}: {
  listingId: string
  initialSaved: boolean
  /** Signed-out viewer: clicking opens the sign-in popup instead of saving. */
  guest?: boolean
  /** What the guest is saving — names the item in the sign-in popup. */
  listing?: { brand: string; title: string; image?: string | null }
  /** Button class name; defaults to the square bookmark. */
  className?: string
  /** Glyph size: 16 beside the brand, 20 on the mobile stage. */
  iconSize?: number
  /** When set, the control is a stacked square: glyph over the live saves count. */
  count?: number
}) {
  const [saved, setSaved] = useState(initialSaved)
  // Live saves tally under the glyph; moves with the viewer's own optimistic toggle.
  const [savesCount, setSavesCount] = useState(count ?? 0)
  const [loading, setLoading] = useState(false)
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()

  async function toggle() {
    if (guest) {
      openAuthModal(pathname, listing ? { title: 'SIGN IN TO SAVE', cta: 'SIGN IN & SAVE →', listing } : undefined)
      return
    }
    setLoading(true)
    const prevSaved = saved
    setSaved((s) => !s) // optimistic
    setSavesCount((c) => c + (prevSaved ? -1 : 1))

    const res = await fetch('/api/saves', {
      method: prevSaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })

    if (!res.ok) {
      setSaved(prevSaved) // rollback
      setSavesCount((c) => c + (prevSaved ? 1 : -1))
    } else if (!prevSaved) {
      trackEvent('listing_saved', { listing_id: listingId })
    }
    setLoading(false)
  }

  const showCount = typeof count === 'number'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`${className}${saved ? ' is-on' : ''}`}
      title={saved ? 'Unsave' : 'Save'}
      aria-pressed={saved}
      aria-label={saved ? `Saved by ${savesCount} — remove from saved` : `Save item — saved by ${savesCount}`}
      data-testid="listing-save-btn"
    >
      <HeartIcon filled={saved} size={iconSize} />
      {showCount && <span className="pdp__save-count" aria-hidden="true">{savesCount}</span>}
    </button>
  )
}
