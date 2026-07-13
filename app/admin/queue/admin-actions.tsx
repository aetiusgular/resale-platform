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
    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {!showReject ? (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={approve}
            disabled={loading}
            style={{ height: '36px', padding: '0 24px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            Approve → active
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            style={{ height: '36px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-alert)', border: '1px solid var(--color-alert)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: 'pointer' }}
          >
            Reject
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px' }}>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (shown to seller)"
            style={{ height: '44px', border: '1px solid var(--color-ink)', borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={reject}
              disabled={loading}
              style={{ height: '36px', padding: '0 24px', background: 'var(--color-alert)', color: 'var(--color-bg)', border: '1px solid var(--color-alert)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              Confirm reject
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(''); setError('') }}
              style={{ height: '36px', padding: '0 16px', background: 'var(--color-bg)', color: 'var(--color-ink-soft)', border: '1px solid var(--color-line)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <span style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</span>}
    </div>
  )
}
