'use client'

/**
 * Post-release review prompt (G9, behind REVIEWS_ENABLED).
 * Rendered by the order page only when the viewer is a party to a RELEASED order
 * and has not yet reviewed in their direction. POSTs to /api/reviews; the RPC is
 * the authoritative eligibility check, this is the affordance + optimistic UX.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReviewPrompt({
  orderId,
  counterpartyLabel,
}: {
  orderId: string
  counterpartyLabel: string
}) {
  const router = useRouter()
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (stars < 1) {
      setError('Pick a star rating first.')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, stars, body }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      router.refresh()
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(
      data.error === 'already_reviewed'
        ? 'You have already reviewed this order.'
        : 'Could not submit your review. Please try again.',
    )
  }

  if (done) {
    return (
      <div style={{ marginTop: 32, padding: '16px 20px', border: '1px solid var(--color-line)', borderRadius: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)' }}>
          Thanks — your review of @{counterpartyLabel} was posted.
        </span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 32, padding: '20px', border: '1px solid var(--color-line)', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)' }}>
        Rate your experience with @{counterpartyLabel}
      </span>
      <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || stars) >= n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(n)}
              style={{
                width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 24, lineHeight: 1, color: filled ? 'var(--color-accent)' : 'var(--color-ink-soft)',
              }}
            >
              {filled ? '★' : '☆'}
            </button>
          )
        })}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note (optional)"
        maxLength={1000}
        rows={3}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 2,
          border: '1px solid var(--color-line)', font: '400 13px var(--font-ui)', color: 'var(--color-ink)',
          background: 'var(--color-bg)', resize: 'vertical',
        }}
      />
      {error && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-accent)' }}>{error}</span>
      )}
      <button
        onClick={submit}
        disabled={loading}
        style={{
          alignSelf: 'flex-start', height: 44, padding: '0 24px', borderRadius: 2,
          cursor: loading ? 'wait' : 'pointer', background: 'var(--color-ink)', color: 'var(--color-bg)',
          border: '1px solid var(--color-ink)', font: '500 14px var(--font-ui)', opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
