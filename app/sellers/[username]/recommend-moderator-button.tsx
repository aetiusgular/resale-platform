'use client'

/**
 * Recommend a member to become a moderator (G10). Only mounted for moderator/admin
 * viewers looking at a non-moderator, ID-verified member. POST /api/moderators/recommend;
 * the server promotes automatically once 3 distinct valid moderators have vouched.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecommendModeratorButton({
  nomineeId,
  initialCount,
  initialRecommended,
  threshold,
}: {
  nomineeId: string
  initialCount: number
  initialRecommended: boolean
  threshold: number
}) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const [recommended, setRecommended] = useState(initialRecommended)
  const [promoted, setPromoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (recommended || loading) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/moderators/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomineeId }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to recommend')
      return
    }
    const d = await res.json()
    setRecommended(true)
    if (typeof d.distinctCount === 'number') setCount(d.distinctCount)
    if (d.promoted) {
      setPromoted(true)
      router.refresh()
    }
  }

  const label = promoted
    ? 'Now a moderator'
    : recommended
      ? `Recommended ✓ (${count} / ${threshold})`
      : `Recommend as moderator (${count} / ${threshold})`

  const disabled = loading || recommended || promoted

  return (
    <span className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className={`btn-follow${recommended || promoted ? ' is-on' : ''}`} onClick={submit} disabled={disabled} aria-pressed={recommended}>
        {label.toUpperCase()}
      </button>
      {error && <span className="alert-line" style={{ paddingTop: 2 }}>{error.toUpperCase()}</span>}
    </span>
  )
}
