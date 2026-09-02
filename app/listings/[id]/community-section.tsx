'use client'

/**
 * Community section (G10) — Legit Check only.
 *
 * General comments were removed. Posting is restricted to moderators/admins (the server
 * RPC is the source of truth; `canPostLc` only governs whether the input is enabled).
 * Comments are publicly readable. System verdicts from the future auto-authentication
 * service arrive as `source: 'auto'` rows (no human author) and render with an
 * "AUTOMATED AUTHENTICATION" label.
 */
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'

type TierBadge = 'bronze' | 'silver' | 'gold'
type CommentSource = 'human' | 'auto'

interface CommentRow {
  id: string
  author_id: string | null
  parent_id: string | null
  body: string
  redacted: boolean
  pinned: boolean
  source: CommentSource
  verdict: string | null
  created_at: string
  profiles: {
    username: string
    tier: TierBadge
    verified_checker: boolean
    role: string
    is_moderator: boolean
    checker_category?: string | null
  } | null
  comment_actions: { id: string; action: string }[]
}

interface CommunitySectionProps {
  listingId: string
  /** true = current viewer may post in LC (moderator or admin). */
  canPostLc: boolean
  /** true = signed-out viewer: Agree/Flag open the sign-in popup instead of 401ing. */
  isGuest?: boolean
}

const TIER_BORDER: Record<TierBadge, string> = {
  bronze: 'var(--color-line)',
  silver: 'var(--color-line)',
  gold:   'var(--color-ink)',
}
const TIER_COLOR: Record<TierBadge, string> = {
  bronze: 'var(--color-ink-soft)',
  silver: 'var(--color-ink)',
  gold:   'var(--color-ink)',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function agreeCount(actions: { action: string }[]): number {
  return actions.filter(a => a.action === 'agree').length
}

export default function CommunitySection({ listingId, canPostLc, isGuest = false }: CommunitySectionProps) {
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [inputBody, setInputBody] = useState('')
  const [posting, setPosting]     = useState(false)
  const [postError, setPostError] = useState('')
  const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set())

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/listings/${listingId}/comments?tab=lc`)
    if (!res.ok) return
    const data = await res.json()
    setComments(data.comments ?? [])
  }, [listingId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const pinned  = comments?.filter(c => c.pinned) ?? []
  const threads = comments?.filter(c => !c.pinned) ?? []
  const lcCount = comments?.length ?? 0

  async function handlePost() {
    if (!inputBody.trim()) return
    setPosting(true)
    setPostError('')
    const res = await fetch(`/api/listings/${listingId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: inputBody.trim(), thread_type: 'lc' }),
    })
    setPosting(false)
    if (!res.ok) {
      const d = await res.json()
      setPostError(d.error ?? 'Failed to post')
      return
    }
    setInputBody('')
    await fetchComments()
  }

  async function handleAgree(commentId: string) {
    if (isGuest) { openAuthModal(pathname); return }
    if (agreedIds.has(commentId)) return
    await fetch(`/api/listings/${listingId}/comments/${commentId}/agree`, { method: 'POST' })
    setAgreedIds(prev => new Set([...prev, commentId]))
    await fetchComments()
  }

  async function handleFlag(commentId: string) {
    if (isGuest) { openAuthModal(pathname); return }
    await fetch(`/api/listings/${listingId}/comments/${commentId}/flag`, { method: 'POST' })
  }

  return (
    <div id="legit-checks" style={{ marginTop: '96px', maxWidth: '840px' }}>
      <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 300, fontSize: '24px', lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>
        The community weighs in.
      </h2>

      {/* Section label (LC-only) */}
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'baseline', borderBottom: '1px solid var(--color-line)' }}>
        <span style={{ position: 'relative', padding: '12px 0', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', minHeight: '44px', display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box' }}>
          Legit check ({lcCount})
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '1px', background: 'var(--color-ink)' }} />
        </span>
      </div>

      {/* Pinned verdict card(s) */}
      {pinned.map(c => (
        <PinnedCard key={c.id} comment={c} />
      ))}

      {/* Threads */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {comments === null ? (
          <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>LOADING…</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>
            NO LEGIT CHECKS YET.
          </div>
        ) : (
          threads.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              agreed={agreedIds.has(c.id)}
              onAgree={() => handleAgree(c.id)}
              onFlag={() => handleFlag(c.id)}
            />
          ))
        )}
      </div>

      {/* Input area */}
      <div style={{ marginTop: '24px' }}>
        {canPostLc ? (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={inputBody}
                onChange={e => setInputBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost() } }}
                placeholder="add a legit check"
                maxLength={2000}
                disabled={posting}
                style={{ flex: 1, height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', boxSizing: 'border-box', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none', opacity: posting ? 0.6 : 1 }}
              />
              <button
                onClick={handlePost}
                disabled={posting || !inputBody.trim()}
                style={{ height: '44px', padding: '0 20px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: posting || !inputBody.trim() ? 'not-allowed' : 'pointer', opacity: posting || !inputBody.trim() ? 0.4 : 1 }}
              >
                Post
              </button>
            </div>
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              Moderators only — legit checks are public.
            </div>
          </>
        ) : (
          <>
            <div
              style={{ height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', fontSize: '14px', color: 'var(--color-ink-soft)', opacity: 0.5, cursor: 'not-allowed' }}
            >
              add a legit check
            </div>
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              Legit checks are posted by verified moderators.
            </div>
          </>
        )}
        {postError && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-alert)' }}>
            {postError}
          </div>
        )}
      </div>
    </div>
  )
}

function AuthorLine({ comment }: { comment: CommentRow }) {
  if (comment.source === 'auto') {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
        AUTOMATED AUTHENTICATION
      </span>
    )
  }
  const author = comment.profiles
  const tier = (author?.tier ?? 'bronze') as TierBadge
  return (
    <>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink)' }}>
        @{author?.username ?? '—'}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 6px', border: `1px solid ${TIER_BORDER[tier]}`, borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: TIER_COLOR[tier] }}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
      {author?.is_moderator && (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
          MODERATOR
        </span>
      )}
    </>
  )
}

function PinnedCard({ comment }: { comment: CommentRow }) {
  return (
    <div
      data-testid="pinned-verdict-card"
      style={{ marginTop: '24px', border: '1px solid var(--color-accent)', borderRadius: '2px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
        {comment.redacted ? (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>CHECKED</span>
            {' '}—{' '}
            <span style={{ textDecoration: 'line-through', color: 'var(--color-ink-soft)' }}>
              {comment.body}
            </span>
            <span style={{ color: 'var(--color-alert)', display: 'block', fontSize: '12px', marginTop: '2px' }}>link removed — off-platform payment offers violate policy.</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>CHECKED</span>
            {' '}— {comment.body}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
        — <AuthorLine comment={comment} />
        {comment.source === 'human' && comment.profiles?.checker_category && (
          <span> | {comment.profiles.checker_category.toUpperCase()}</span>
        )}
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  agreed,
  onAgree,
  onFlag,
}: {
  comment: CommentRow
  agreed: boolean
  onAgree: () => void
  onFlag: () => void
}) {
  const agrees = agreeCount(comment.comment_actions)

  return (
    <div
      data-testid="comment-row"
      style={{ padding: '20px 0', borderBottom: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AuthorLine comment={comment} />
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          {relativeTime(comment.created_at)}
        </span>
      </div>

      {/* Body */}
      {comment.redacted ? (
        <div>
          <span style={{ fontSize: '14px', lineHeight: 1.6, textDecoration: 'line-through', color: 'var(--color-ink-soft)' }}>
            {comment.body}
          </span>
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-alert)' }}>
            link removed — off-platform payment offers violate policy.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
          {comment.body}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onAgree}
          data-testid="agree-button"
          style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: agreed ? 'var(--color-ink)' : 'var(--color-ink-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: agreed ? 'underline' : 'none' }}
        >
          Agree ({agrees})
        </button>
        <button
          onClick={onFlag}
          data-testid="flag-button"
          style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Flag
        </button>
      </div>
    </div>
  )
}
