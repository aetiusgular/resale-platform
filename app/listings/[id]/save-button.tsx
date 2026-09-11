'use client'

/**
 * Listing-page save control — the square bookmark next to MESSAGE SELLER
 * (design 4A). Optimistic; guests get the sign-in popup instead of the API —
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
  caption = false,
}: {
  listingId: string
  initialSaved: boolean
  /** Signed-out viewer: clicking opens the sign-in popup instead of saving. */
  guest?: boolean
  /** What the guest is saving — names the item in the sign-in popup. */
  listing?: { brand: string; title: string; image?: string | null }
  /** Caption bookmark (same as listing cards), not a boxed control. */
  caption?: boolean
}) {
  const [saved, setSaved] = useState(initialSaved)
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

    const res = await fetch('/api/saves', {
      method: prevSaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })

    if (!res.ok) {
      setSaved(prevSaved) // rollback
    } else if (!prevSaved) {
      trackEvent('listing_saved', { listing_id: listingId })
    }
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={caption ? `card__save${saved ? ' is-saved' : ''}` : `btn-square${saved ? ' is-on' : ''}`}
      title={saved ? 'Unsave' : 'Save'}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save item'}
      data-testid="listing-save-btn"
    >
      <HeartIcon filled={saved} size={20} />
    </button>
  )
}
