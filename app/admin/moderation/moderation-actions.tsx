'use client'

/**
 * One-click moderation actions (G6 console). Wires the admin queues to the action
 * endpoints: remove/restore (listings), ban/unban (users), and dismiss (audit-only).
 * Destructive actions (remove/ban/dismiss) require a reason. The endpoints are the
 * authority (admin-checked + audit-logged); this is the affordance.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'remove' | 'restore' | 'dismiss' | 'ban' | 'unban' | 'release' | 'refund' | 'authenticate' | 'reject_auth'
type TargetType = 'listing' | 'user' | 'message' | 'comment' | 'order'

const ENDPOINT: Record<Action, string> = {
  remove: '/api/admin/moderation/remove',
  restore: '/api/admin/moderation/restore',
  dismiss: '/api/admin/moderation',
  ban: '/api/admin/moderation/ban',
  unban: '/api/admin/moderation/unban',
  release: '/api/admin/moderation/release-hold',
  refund: '/api/admin/moderation/refund',
  authenticate: '/api/admin/moderation/authenticate',
  reject_auth: '/api/admin/moderation/reject-auth',
}
const NEEDS_REASON: Action[] = ['remove', 'ban', 'dismiss', 'release', 'refund', 'reject_auth']
const DESTRUCTIVE: Action[] = ['remove', 'ban', 'refund', 'reject_auth']
const AFFIRMATIVE: Action[] = ['restore', 'unban', 'release', 'authenticate']
const LABEL: Record<Action, string> = {
  remove: 'REMOVE', restore: 'RESTORE', dismiss: 'DISMISS', ban: 'BAN', unban: 'UNBAN', release: 'RELEASE PAYOUT', refund: 'REFUND BUYER', authenticate: 'AUTHENTICATE', reject_auth: 'REJECT',
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
    <div className="stack" style={{ gap: 10 }}>
      {needsReason && (
        <input
          type="text"
          className="input-sans"
          style={{ maxWidth: 520 }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason — required for remove / ban / dismiss; logged to the audit trail"
          aria-label="Reason"
        />
      )}
      <div className="admin-actions">
        {actions.map((a) => {
          const destructive = DESTRUCTIVE.includes(a)
          const affirmative = AFFIRMATIVE.includes(a)
          return (
            <button
              key={a}
              type="button"
              className={`btn-mini ${affirmative ? 'btn-mini--solid' : 'btn-mini--outline'}`}
              style={destructive ? { color: 'var(--alert)', borderColor: 'var(--alert)' } : undefined}
              onClick={() => run(a)}
              disabled={loading !== null}
              data-testid={`mod-${a}`}
            >
              {loading === a ? '…' : LABEL[a]}
            </button>
          )
        })}
      </div>
      {error && <div className="alert-line" role="alert" style={{ paddingTop: 0 }}>{error.toUpperCase()}</div>}
    </div>
  )
}
