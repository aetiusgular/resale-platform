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
    <div>
      <div className="admin-actions">
        {currentStatus !== 'removed' && (
          <button type="button" className="btn-mini btn-mini--outline" style={{ color: 'var(--alert)', borderColor: 'var(--alert)' }} onClick={() => call(`${base}/remove`)} disabled={loading}>
            REMOVE
          </button>
        )}
        {currentStatus === 'removed' && (
          <button type="button" className="btn-mini btn-mini--outline" onClick={() => call(`${base}/restore`)} disabled={loading}>
            RESTORE
          </button>
        )}
        <button type="button" className={`btn-mini ${pinned ? 'btn-mini--solid' : 'btn-mini--outline'}`} onClick={() => call(`${base}/pin`, { pinned: !pinned })} disabled={loading}>
          {pinned ? 'UNPIN' : 'PIN VERDICT'}
        </button>
        <a href={`/listings/${listingId}`} target="_blank" rel="noreferrer" className="link-underline">VIEW LISTING ↗</a>
      </div>
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
    </div>
  )
}
