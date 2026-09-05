'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminActionsProps {
  listingId: string
}

export default function AdminActions({ listingId }: AdminActionsProps) {
  const router = useRouter()
  const [loading, setLoading]       = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason]         = useState('')
  const [error, setError]           = useState('')

  const approve = async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/listings/${listingId}/approve`, { method: 'POST' })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'approve failed')
    }
  }

  const reject = async () => {
    if (!reason.trim()) { setError('rejection reason required'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/listings/${listingId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? 'reject failed')
    }
  }

  return (
    <div className="admin-item__foot">
      {!showReject ? (
        <div className="admin-actions">
          <button type="button" className="btn-mini btn-mini--solid" onClick={approve} disabled={loading} data-testid="admin-approve">
            {loading ? 'APPROVING…' : 'APPROVE → ACTIVE'}
          </button>
          <button type="button" className="btn-mini btn-mini--outline" style={{ color: 'var(--alert)', borderColor: 'var(--alert)' }} onClick={() => setShowReject(true)} disabled={loading} data-testid="admin-reject">
            REJECT
          </button>
        </div>
      ) : (
        <div className="admin-actions">
          <input
            type="text"
            className="input-sans"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (shown to the seller)"
            aria-label="Rejection reason"
            autoFocus
          />
          <button type="button" className="btn-mini btn-mini--solid" style={{ background: 'var(--alert)', borderColor: 'var(--alert)' }} onClick={reject} disabled={loading} data-testid="admin-reject-confirm">
            {loading ? 'REJECTING…' : 'CONFIRM REJECT'}
          </button>
          <button type="button" className="btn-mini btn-mini--link" onClick={() => { setShowReject(false); setReason(''); setError('') }}>
            CANCEL
          </button>
        </div>
      )}
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
    </div>
  )
}
