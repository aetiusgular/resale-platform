'use client'

/**
 * Post-release review prompt (G9, behind REVIEWS_ENABLED) — design "Leave a review".
 * Rendered by the order page only when the viewer is a party to a RELEASED order
 * and has not yet reviewed in their direction. POSTs to /api/reviews; the RPC is
 * the authoritative eligibility check, this is the affordance + optimistic UX.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RATE_WORDS = ['POOR', 'FAIR', 'GOOD', 'GREAT', 'EXCELLENT']

export default function ReviewPrompt({
  orderId,
  counterpartyLabel,
}: {
  orderId: string
  counterpartyLabel: string
}) {
  const router = useRouter()
  const [stars, setStars] = useState(0)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (stars < 1) {
      setError('Pick a rating first.')
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
        : data.error ?? 'Could not post the review — try again.',
    )
  }

  if (done) {
    return <div className="ok-line mt-24">THANKS — YOUR REVIEW OF @{counterpartyLabel.toUpperCase()} WAS POSTED.</div>
  }

  return (
    <div className="mt-32" data-testid="review-prompt">
      <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">LEAVE A REVIEW</span><span className="page-note">PUBLIC ON @{counterpartyLabel.toUpperCase()}&rsquo;S PROFILE</span></div>
      <div className="review-label">RATING</div>
      <div className="rate-row">
        <span className="rate-cells" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`Rate ${n} of 5`} className={`rate-cell${n <= stars ? ' is-on' : ''}`} onClick={() => setStars(n)}>
              {n}
            </button>
          ))}
        </span>
        <span className="rate-word">{stars ? `${stars} / 5 — ${RATE_WORDS[stars - 1]}` : 'PICK A RATING'}</span>
      </div>
      <div className="review-label">YOUR REVIEW <em>— OPTIONAL</em></div>
      <textarea
        className="review-text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="How was the item and the sale? Condition, packaging, timing —"
        maxLength={1000}
        aria-label="Your review"
      />
      <div className="review-count"><span>PUBLIC · TIED TO THIS ORDER</span><span>{body.length} / 1000</span></div>
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
      <div className="save-row save-row--left">
        <button type="button" className="btn-primary btn-primary--inline" onClick={submit} disabled={loading}>
          {loading ? 'SUBMITTING…' : 'SUBMIT REVIEW →'}
        </button>
      </div>
    </div>
  )
}
