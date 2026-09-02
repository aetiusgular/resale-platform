'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import Icon from '@/app/components/icon'
import { useStudio } from '@/app/components/studio'

export default function SaveButton({
  listingId,
  initialSaved,
  guest = false,
  variant = 'inline',
}: {
  listingId: string
  initialSaved: boolean
  /** Signed-out viewer: clicking opens the sign-in popup instead of saving. */
  guest?: boolean
  /** inline = buy column text link; overlay = icon-only on gallery image; action = 44px square icon button */
  variant?: 'inline' | 'overlay' | 'action'
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)
  const [pop, setPop] = useState(false)
  const mounted = useRef(false)
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const studio = useStudio()
  const mark = studio.iconSize + 2

  useEffect(() => {
    mounted.current = true
  }, [])

  function triggerPop() {
    if (!mounted.current) return
    setPop(true)
    window.setTimeout(() => setPop(false), 200)
  }

  async function toggle() {
    if (guest) {
      openAuthModal(pathname)
      return
    }
    setLoading(true)
    const prevSaved = saved
    setSaved(s => !s) // optimistic

    const res = await fetch('/api/saves', {
      method: prevSaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })

    if (!res.ok) {
      setSaved(prevSaved) // rollback
    } else {
      triggerPop()
      if (!prevSaved) {
        trackEvent('listing_saved', { listing_id: listingId })
      }
    }
    setLoading(false)
  }

  if (variant === 'action') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        data-testid="listing-save-btn"
        className={`pdp-action-btn${saved ? ' pdp-action-btn--active' : ''}${pop ? ' motion-pop-once' : ''}`}
        aria-label={saved ? 'saved' : 'save'}
        aria-pressed={saved}
      >
        <Icon name="save" weight={saved ? 'fill' : studio.iconWeight} size={mark} />
      </button>
    )
  }

  if (variant === 'overlay') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        data-testid="listing-save-btn"
        className={`card-save card-save-overlay${pop ? ' motion-pop-once' : ''}`}
        aria-label={saved ? 'saved' : 'save'}
        aria-pressed={saved}
      >
        <span aria-hidden className="card-save-overlay-hit" />
        <Icon name="save" weight={saved ? 'fill' : studio.iconWeight} size={mark} />
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      data-testid="listing-save-btn"
      className={`listing-buy-save${pop ? ' motion-pop-once' : ''}`}
      aria-label={saved ? 'saved' : 'save'}
      aria-pressed={saved}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          width: 44,
          height: 44,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <Icon name="save" weight={saved ? 'fill' : studio.iconWeight} size={mark} />
      {saved ? 'saved' : 'save'}
    </button>
  )
}
