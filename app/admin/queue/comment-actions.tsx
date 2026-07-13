'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CommentActionsProps {
  commentId: string
  listingId: string
  currentStatus: string
  pinned: boolean
}

export default function CommentActions({ commentId, listingId, currentStatus, pinned }: CommentActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function call(path: string, body?: object) {
    setLoading(true)
    setError('')
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Action failed')
    }
  }

  const base = `/api/admin/comments/${commentId}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {currentStatus !== 'removed' && (
        <button
          onClick={() => call(`${base}/remove`)}
          disabled={loading}
          style={{ height: '32px', padding: '0 16px', background: 'var(--color-alert)', color: 'var(--color-bg)', border: '1px solid var(--color-alert)', borderRadius: '2px', font: '500 12px var(--font-ui)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          Remove
        </button>
      )}
      {currentStatus === 'removed' && (
        <button
          onClick={() => call(`${base}/restore`)}
          disabled={loading}
          style={{ height: '32px', padding: '0 16px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 12px var(--font-ui)', cursor: loading ? 'wait' : 'pointer' }}
        >
          Restore
        </button>
      )}
      <button
        onClick={() => call(`${base}/pin`, { pinned: !pinned })}
        disabled={loading}
        style={{ height: '32px', padding: '0 16px', background: pinned ? 'var(--color-ink)' : 'var(--color-bg)', color: pinned ? 'var(--color-bg)' : 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 12px var(--font-ui)', cursor: loading ? 'wait' : 'pointer' }}
      >
        {pinned ? 'Unpin' : 'Pin verdict'}
      </button>
      <a
        href={`/listings/${listingId}`}
        target="_blank"
        rel="noreferrer"
        style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}
      >
        View listing ↗
      </a>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</span>}
    </div>
  )
}
