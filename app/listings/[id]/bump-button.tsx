'use client'

/**
 * Bump button for the SELLER's own active listing. POSTs to /api/listings/[id]/bump
 * and refreshes on success; on 409 shows the next free-bump time + the markdown hint.
 * Mount only on the seller's own listing view, and only when BUMP_ENABLED (gate at the
 * server component that renders it so it never appears for other users / when off).
 * Styling is intentionally minimal — swap in the design-system button + text styles.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BumpButton({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const bump = async () => {
    setLoading(true)
    setMessage('')
    const res = await fetch(`/api/listings/${listingId}/bump`, { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      router.refresh()
      return
    }
    const data = await res.json().catch(() => ({}))
    if (res.status === 429) {
      setMessage('Too many requests — try again shortly.')
    } else if (res.status === 409 && typeof data.nextEligibleAtMs === 'number') {
      const when = new Date(data.nextEligibleAtMs).toLocaleDateString()
      setMessage(`Next free bump ${when} — or drop the price 10% to bump now.`)
    } else {
      setMessage(data.error ?? 'Could not bump this listing.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={bump}
        disabled={loading}
        style={{
          height: '36px', padding: '0 24px', borderRadius: '2px', cursor: loading ? 'wait' : 'pointer',
          background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)',
          font: '500 13px var(--font-ui)', opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Bumping…' : 'Bump listing'}
      </button>
      {message && <span style={{ fontSize: '12px', color: 'var(--color-ink-soft)' }}>{message}</span>}
    </div>
  )
}
