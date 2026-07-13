'use client'

import { useState, useEffect, useCallback } from 'react'

type ThreadType = 'lc' | 'general'
type TierBadge = 'bronze' | 'silver' | 'gold'

interface CommentRow {
  id: string
  author_id: string
  parent_id: string | null
  body: string
  redacted: boolean
  pinned: boolean
  created_at: string
  profiles: {
    username: string
    tier: TierBadge
    verified_checker: boolean
    role: string
    checker_category?: string | null
  } | null
  comment_actions: { id: string; action: string }[]
}

interface CommunitySectionProps {
  listingId: string
  commentsEnabled: boolean
  /** true = current viewer can post in LC (verified_checker or gold or admin) */
  canPostLc: boolean
  /** true = current viewer is id-verified or admin */
  canComment: boolean
  /** true = viewing user is the seller */
  isSeller: boolean
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
  if (mins < 60) return `${mins}M AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  return `${Math.floor(hrs / 24)}D AGO`
}

function agreeCount(actions: { action: string }[]): number {
  return actions.filter(a => a.action === 'agree').length
}

export default function CommunitySection({
  listingId,
  commentsEnabled,
  canPostLc,
  canComment,
  isSeller,
}: CommunitySectionProps) {
  const [tab, setTab]               = useState<ThreadType>('lc')
  const [lcComments, setLcComments] = useState<CommentRow[] | null>(null)
  const [genComments, setGenComments] = useState<CommentRow[] | null>(null)
  const [inputBody, setInputBody]   = useState('')
  const [posting, setPosting]       = useState(false)
  const [postError, setPostError]   = useState('')
  const [agreedIds, setAgreedIds]   = useState<Set<string>>(new Set())

  const fetchTab = useCallback(async (t: ThreadType) => {
    const res = await fetch(`/api/listings/${listingId}/comments?tab=${t}`)
    if (!res.ok) return
    const data = await res.json()
    if (t === 'lc') setLcComments(data.comments ?? [])
    else            setGenComments(data.comments ?? [])
  }, [listingId])

  useEffect(() => { fetchTab('lc') }, [fetchTab])
  useEffect(() => {
    if (commentsEnabled) fetchTab('general')
  }, [fetchTab, commentsEnabled])

  const currentComments = tab === 'lc' ? lcComments : genComments
  const pinned = currentComments?.filter(c => c.pinned) ?? []
  const threads = currentComments?.filter(c => !c.pinned) ?? []

  const lcCount  = lcComments?.length ?? 0
  const genCount = genComments?.length ?? 0

  async function handlePost() {
    if (!inputBody.trim()) return
    setPosting(true)
    setPostError('')
    const res = await fetch(`/api/listings/${listingId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: inputBody.trim(), thread_type: tab }),
    })
    setPosting(false)
    if (!res.ok) {
      const d = await res.json()
      setPostError(d.error ?? 'Failed to post')
      return
    }
    setInputBody('')
    await fetchTab(tab)
  }

  async function handleAgree(commentId: string) {
    if (agreedIds.has(commentId)) return
    await fetch(`/api/listings/${listingId}/comments/${commentId}/agree`, { method: 'POST' })
    setAgreedIds(prev => new Set([...prev, commentId]))
    await fetchTab(tab)
  }

  async function handleFlag(commentId: string) {
    await fetch(`/api/listings/${listingId}/comments/${commentId}/flag`, { method: 'POST' })
  }

  const canPostCurrent = tab === 'lc' ? canPostLc : (canComment && commentsEnabled)
  const inputPlaceholder = tab === 'lc' ? 'add a legit check' : 'add a comment'

  return (
    <div style={{ marginTop: '96px', maxWidth: '840px' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: '24px', lineHeight: 1.35, color: 'var(--color-ink)', margin: 0 }}>
        The community weighs in.
      </h2>

      {/* Tab bar */}
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'baseline', gap: '32px', borderBottom: '1px solid var(--color-line)' }}>
        <button
          onClick={() => setTab('lc')}
          style={{ position: 'relative', paddingBottom: '12px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: tab === 'lc' ? 'var(--color-ink)' : 'var(--color-ink-soft)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          Legit check ({lcCount})
          {tab === 'lc' && <span style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '1px', background: 'var(--color-ink)' }} />}
        </button>

        {commentsEnabled && (
          <button
            onClick={() => setTab('general')}
            style={{ position: 'relative', paddingBottom: '12px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: tab === 'general' ? 'var(--color-ink)' : 'var(--color-ink-soft)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Comments ({genCount})
            {tab === 'general' && <span style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '1px', background: 'var(--color-ink)' }} />}
          </button>
        )}

        {/* Seller status indicator on general tab */}
        {tab === 'general' && commentsEnabled && (
          <span style={{ marginLeft: 'auto', paddingBottom: '12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
            SELLER HAS COMMENTS ON
          </span>
        )}
      </div>

      {/* Pinned verdict card */}
      {pinned.map(c => (
        <PinnedCard key={c.id} comment={c} />
      ))}

      {/* Comment threads */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {currentComments === null ? (
          <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>LOADING…</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>
            {tab === 'lc' ? 'NO LEGIT CHECKS YET.' : 'NO COMMENTS YET.'}
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
        {canPostCurrent ? (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={inputBody}
                onChange={e => setInputBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost() } }}
                placeholder={inputPlaceholder}
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
              ID-verified members only · new accounts limited to 2 comments/day
            </div>
          </>
        ) : (
          <>
            <div
              style={{ height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', fontSize: '14px', color: 'var(--color-ink-soft)', opacity: 0.5, cursor: 'not-allowed' }}
            >
              {inputPlaceholder}
            </div>
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              {tab === 'lc'
                ? 'ID-verified members only · new accounts limited to 2 comments/day'
                : !canComment
                  ? 'ID-verified members only · new accounts limited to 2 comments/day'
                  : 'ID-verified members only · new accounts limited to 2 comments/day'}
            </div>
          </>
        )}
        {postError && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-alert)' }}>
            {postError}
          </div>
        )}
      </div>

      {/* Seller toggle (only visible to listing's seller) */}
      {isSeller && <SellerToggle listingId={listingId} commentsEnabled={commentsEnabled} />}
    </div>
  )
}

function PinnedCard({ comment }: { comment: CommentRow }) {
  const author = comment.profiles
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
      {author && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          — @{author.username}
          {author.verified_checker && (
            <span style={{ fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>VERIFIED CHECKER</span>
          )}
          {author.checker_category && (
            <span>· {author.checker_category.toUpperCase()}</span>
          )}
        </div>
      )}
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
  const author = comment.profiles
  const tier   = (author?.tier ?? 'bronze') as TierBadge
  const agrees = agreeCount(comment.comment_actions)

  return (
    <div
      data-testid="comment-row"
      style={{ padding: '20px 0', borderBottom: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink)' }}>
          @{author?.username ?? '—'}
        </span>
        {/* Tier badge */}
        <span style={{ display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 6px', border: `1px solid ${TIER_BORDER[tier]}`, borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: TIER_COLOR[tier] }}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </span>
        {/* Verified checker microtag */}
        {author?.verified_checker && (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>
            VERIFIED CHECKER
          </span>
        )}
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

function SellerToggle({ listingId, commentsEnabled }: { listingId: string; commentsEnabled: boolean }) {
  const [enabled, setEnabled] = useState(commentsEnabled)
  const [saving, setSaving]   = useState(false)

  async function toggle() {
    setSaving(true)
    const next = !enabled
    const res = await fetch(`/api/listings/${listingId}/comments-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    setSaving(false)
    if (res.ok) setEnabled(next)
  }

  return (
    <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
        GENERAL COMMENTS
      </span>
      <button
        onClick={toggle}
        disabled={saving}
        data-testid="comments-toggle"
        style={{ height: '28px', padding: '0 14px', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', background: enabled ? 'var(--color-ink)' : 'var(--color-bg)', color: enabled ? 'var(--color-bg)' : 'var(--color-ink-soft)', border: '1px solid var(--color-ink)', borderRadius: '2px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {enabled ? 'On' : 'Off'}
      </button>
      <span style={{ fontSize: '12px', color: 'var(--color-ink-soft)' }}>
        LC thread is always visible
      </span>
    </div>
  )
}
