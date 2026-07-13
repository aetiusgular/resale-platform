'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

export default function SaveButton({
  listingId,
  initialSaved,
}: {
  listingId: string
  initialSaved: boolean
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function toggle() {
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
    } else if (!prevSaved) {
      trackEvent('listing_saved', { listing_id: listingId })
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      data-testid="listing-save-btn"
      style={{
        height: '44px', padding: '0 20px',
        background: saved ? 'var(--color-ink)' : 'var(--color-bg)',
        color: saved ? 'var(--color-bg)' : 'var(--color-ink)',
        border: '1px solid var(--color-ink)', borderRadius: '2px',
        fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
        textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 120ms linear', opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {saved ? 'SAVED' : 'SAVE'}
    </button>
  )
}
