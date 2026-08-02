'use client'

/**
 * One-click moderation actions (G6 console). Wires the admin queues to the action
 * endpoints: remove/restore (listings), ban/unban (users), and dismiss (audit-only).
 * Destructive actions (remove/ban/dismiss) require a reason. The endpoints are the
 * authority (admin-checked + audit-logged); this is the affordance.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'remove' | 'restore' | 'dismiss' | 'ban' | 'unban' | 'release' | 'refund'
type TargetType = 'listing' | 'user' | 'message' | 'comment' | 'order'

const ENDPOINT: Record<Action, string> = {
  remove: '/api/admin/moderation/remove',
  restore: '/api/admin/moderation/restore',
  dismiss: '/api/admin/moderation',
  ban: '/api/admin/moderation/ban',
  unban: '/api/admin/moderation/unban',
  release: '/api/admin/moderation/release-hold',
  refund: '/api/admin/moderation/refund',
}
const NEEDS_REASON: Action[] = ['remove', 'ban', 'dismiss', 'release', 'refund']
const DESTRUCTIVE: Action[] = ['remove', 'ban', 'refund']
const LABEL: Record<Action, string> = {
  remove: 'Remove', restore: 'Restore', dismiss: 'Dismiss', ban: 'Ban', unban: 'Unban', release: 'Release payout', refund: 'Refund buyer',
}

export default function ModerationActions({
  targetType,
  targetId,
  actions,
}: {
  targetType: TargetType
  targetId: string
  actions: Action[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const needsReason = actions.some((a) => NEEDS_REASON.includes(a))

  const run = async (action: Action) => {
    if (NEEDS_REASON.includes(action) && !reason.trim()) {
      setError(`${LABEL[action]} needs a reason.`)
      return
    }
    setLoading(action)
    setError('')
    const payload: Record<string, unknown> = { target_type: targetType, target_id: targetId }
    if (action === 'dismiss') payload.action = 'dismiss'
    if (reason.trim()) payload.reason = reason.trim()
    const res = await fetch(ENDPOINT[action], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setLoading(null)
    if (res.ok) {
      router.refresh()
      return
    }
    const d = await res.json().catch(() => ({}))
    setError(d.error ?? `${LABEL[action]} failed`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {needsReason && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required for remove / ban / dismiss — logged to the audit trail)"
          style={{ height: '40px', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', fontSize: '13px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none', maxWidth: '560px' }}
        />
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {actions.map((a) => {
          const destructive = DESTRUCTIVE.includes(a)
          return (
            <button
              key={a}
              onClick={() => run(a)}
              disabled={loading !== null}
              style={{
                height: '36px', padding: '0 20px', borderRadius: '2px',
                cursor: loading ? 'wait' : 'pointer',
                font: '500 13px var(--font-ui)',
                background: destructive ? 'var(--color-bg)' : a === 'restore' || a === 'unban' || a === 'release' ? 'var(--color-ink)' : 'var(--color-bg)',
                color: destructive ? 'var(--color-alert)' : a === 'restore' || a === 'unban' || a === 'release' ? 'var(--color-bg)' : 'var(--color-ink)',
                border: `1px solid ${destructive ? 'var(--color-alert)' : 'var(--color-ink)'}`,
                opacity: loading === a ? 0.6 : 1,
              }}
            >
              {loading === a ? '…' : LABEL[a]}
            </button>
          )
        })}
      </div>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</span>}
    </div>
  )
}
