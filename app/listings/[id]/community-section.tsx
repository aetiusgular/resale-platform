'use client'

/**
 * Legit Check thread (design 4A "lc-section").
 *
 * Strip: "[check] n LEGIT  [flag] n FLAGGED" (counts only; icons from components/icons).
 * Comments carry the author's vote as a tag (LC LEGIT / LC FLAG), moderators are
 * tagged LC MOD, system rows AUTO-AUTH; the meta line is "AGREE n | FLAG | REPLY"
 * with hairline separators (.sep), not middots.
 * Any verified member can post a comment and cast ONE vote per listing (the
 * post_comment RPC enforces it); moderators sign the verdict (pinned card).
 * General comments stay removed (G10).
 */
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { CheckThinIcon, FlagIcon } from '@/app/components/icons'

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
  vote: 'legit' | 'flag' | null
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

type Tally = { legit: number; flagged: number; autoAuth: string; verdict: string }

interface CommunitySectionProps {
  listingId: string
  /** true = signed-out viewer: actions open the sign-in popup instead of 401ing. */
  isGuest?: boolean
  /** true = current viewer may post (verified member, moderator or admin). */
  canPost: boolean
  /** Sold listing: the thread stays readable but takes no new posts. */
  closed?: boolean
  /** Server-rendered initial tally so the strip never flashes zeros. */
  initialTally: Tally
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}M AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  return `${Math.floor(hrs / 24)}D AGO`
}

function agreeCount(actions: { action: string }[]): number {
  return actions.filter((a) => a.action === 'agree').length
}

export default function CommunitySection({ listingId, isGuest = false, canPost, closed = false, initialTally }: CommunitySectionProps) {
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [tally, setTally]         = useState<Tally>(initialTally)
  const [inputBody, setInputBody] = useState('')
  const [vote, setVote]           = useState<'legit' | 'flag' | null>(null)
  const [replyTo, setReplyTo]     = useState<CommentRow | null>(null)
  const [posting, setPosting]     = useState(false)
  const [postError, setPostError] = useState('')
  const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set())
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())

  // Promise chain rather than async/await so the state update only ever runs
  // inside the resolved callback (never synchronously in the effect body).
  const fetchComments = useCallback(() => {
    return fetch(`/api/listings/${listingId}/comments?tab=lc`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { comments?: CommentRow[]; tally?: Tally } | null) => {
        if (!data) return
        setComments(data.comments ?? [])
        if (data.tally) setTally(data.tally)
      })
      .catch(() => { /* leave the current list in place */ })
  }, [listingId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const pinned  = comments?.filter((c) => c.pinned) ?? []
  const threads = comments?.filter((c) => !c.pinned) ?? []

  async function handlePost() {
    if (isGuest) { openAuthModal(pathname); return }
    if (!inputBody.trim() && !vote) return
    setPosting(true)
    setPostError('')
    const res = await fetch(`/api/listings/${listingId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: inputBody.trim() || (vote === 'legit' ? 'Voted LEGIT.' : 'Voted FLAG.'),
        thread_type: 'lc',
        vote,
        parent_id: replyTo?.id ?? null,
      }),
    })
    setPosting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setPostError(d.error ?? 'Failed to post')
      return
    }
    setInputBody('')
    setVote(null)
    setReplyTo(null)
    await fetchComments()
  }

  async function handleAgree(commentId: string) {
    if (isGuest) { openAuthModal(pathname); return }
    if (agreedIds.has(commentId)) return
    await fetch(`/api/listings/${listingId}/comments/${commentId}/agree`, { method: 'POST' })
    setAgreedIds((prev) => new Set([...prev, commentId]))
    await fetchComments()
  }

  async function handleFlag(commentId: string) {
    if (isGuest) { openAuthModal(pathname); return }
    await fetch(`/api/listings/${listingId}/comments/${commentId}/flag`, { method: 'POST' })
    setFlaggedIds((prev) => new Set([...prev, commentId]))
  }

  function handleReply(c: CommentRow) {
    if (isGuest) { openAuthModal(pathname); return }
    setReplyTo(c)
    document.getElementById('lc-input')?.focus()
  }

  const inputDisabled = closed || (!isGuest && !canPost)

  return (
    <section className="lc-section" id="lc-thread" aria-labelledby="lc-heading">
      <h2 id="lc-heading" className="sr-only">The community weighs in.</h2>
      <div className="lc-strip">
        <span className="lc-strip__left">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckThinIcon size={11} />{tally.legit} LEGIT</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><FlagIcon />{tally.flagged} FLAGGED</span>
        </span>
      </div>

      {pinned.map((c) => (
        <PinnedCard key={c.id} comment={c} />
      ))}

      {comments === null ? (
        <div className="mono-note" style={{ paddingBottom: 14 }}>LOADING…</div>
      ) : threads.length === 0 && pinned.length === 0 ? null : (
        threads.map((c) => (
          <CommentRowView
            key={c.id}
            comment={c}
            parent={c.parent_id ? comments?.find((p) => p.id === c.parent_id) ?? null : null}
            agreed={agreedIds.has(c.id)}
            flagged={flaggedIds.has(c.id)}
            onAgree={() => handleAgree(c.id)}
            onFlag={() => handleFlag(c.id)}
            onReply={() => handleReply(c)}
          />
        ))
      )}

      {replyTo && (
        <div className="mono-note" style={{ paddingBottom: 6 }}>
          REPLYING TO {(replyTo.profiles?.username ?? 'SYSTEM').toUpperCase()}<span className="sep" aria-hidden="true" />
          <button type="button" className="link-underline" onClick={() => setReplyTo(null)}>CANCEL</button>
        </div>
      )}
      <div className="lc-form">
        <input
          id="lc-input"
          className="lc-input"
          type="text"
          value={inputBody}
          onChange={(e) => setInputBody(e.target.value)}
          onFocus={() => { if (isGuest) openAuthModal(pathname) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost() } }}
          placeholder="Add a comment or cast a vote —"
          aria-label="Add a legit check comment"
          maxLength={2000}
          disabled={posting || inputDisabled}
          data-testid="lc-input"
        />
        <button
          type="button"
          className={`btn-mini${vote === 'legit' ? ' btn-mini--solid' : ''}`}
          onClick={() => setVote((v) => (v === 'legit' ? null : 'legit'))}
          disabled={inputDisabled}
          aria-pressed={vote === 'legit'}
          title="Cast a LEGIT vote with your comment"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <CheckThinIcon size={11} />LEGIT
        </button>
        <button
          type="button"
          className={`btn-mini${vote === 'flag' ? ' btn-mini--solid' : ''}`}
          onClick={() => setVote((v) => (v === 'flag' ? null : 'flag'))}
          disabled={inputDisabled}
          aria-pressed={vote === 'flag'}
          title="Cast a FLAG vote with your comment"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <FlagIcon />FLAG
        </button>
        <button type="button" className="btn-mini btn-mini--solid" onClick={handlePost} disabled={posting || inputDisabled || (!inputBody.trim() && !vote)} data-testid="lc-post">
          POST
        </button>
      </div>
      {(closed || inputDisabled) && (
        <div className="mono-note" style={{ paddingTop: 8 }}>
          {closed
            ? 'THREAD CLOSED — THIS ITEM HAS SOLD'
            : <>VERIFIED MEMBERS CAN COMMENT AND CAST ONE VOTE PER LISTING<span className="sep" aria-hidden="true" />VERIFY YOUR ID IN SETTINGS</>}
        </div>
      )}
      {postError && <div className="alert-line" role="alert">{postError.toUpperCase()}</div>}
    </section>
  )
}

function AuthorLine({ comment }: { comment: CommentRow }) {
  if (comment.source === 'auto') {
    return (
      <>
        SYSTEM <span className="tag tag--ink">AUTO-AUTH</span>
      </>
    )
  }
  const author = comment.profiles
  return (
    <>
      {(author?.username ?? '—').toUpperCase()}
      {author?.is_moderator || author?.role === 'admin'
        ? <span className="tag tag--ink">LC MOD</span>
        : comment.vote
          ? <span className="tag">LC {comment.vote === 'legit' ? 'LEGIT' : 'FLAG'}</span>
          : null}
      {author?.checker_category && <span className="tag">{author.checker_category.toUpperCase()}</span>}
    </>
  )
}

function Body({ comment }: { comment: CommentRow }) {
  if (comment.redacted) {
    return (
      <>
        <p className="lc-comment__text" style={{ textDecoration: 'line-through', color: 'var(--faint)' }}>{comment.body}</p>
        <div className="alert-line" style={{ paddingTop: 4 }}>LINK REMOVED — OFF-PLATFORM PAYMENT OFFERS VIOLATE POLICY.</div>
      </>
    )
  }
  return <p className="lc-comment__text">{comment.body}</p>
}

function PinnedCard({ comment }: { comment: CommentRow }) {
  return (
    <div className="lc-comment lc-comment--pinned" data-testid="pinned-verdict-card">
      <span className="lc-comment__avatar" style={{ background: 'var(--ink)' }} />
      <div className="lc-comment__body">
        <div className="lc-comment__who">
          <span className="tag tag--ink">VERDICT</span>
          <AuthorLine comment={comment} />
        </div>
        <Body comment={comment} />
        <div className="lc-comment__meta">SIGNED {relativeTime(comment.created_at)}{comment.verdict && <><span className="sep" aria-hidden="true" />{comment.verdict.toUpperCase()}</>}</div>
      </div>
    </div>
  )
}

function CommentRowView({
  comment, parent, agreed, flagged, onAgree, onFlag, onReply,
}: {
  comment: CommentRow
  parent: CommentRow | null
  agreed: boolean
  flagged: boolean
  onAgree: () => void
  onFlag: () => void
  onReply: () => void
}) {
  const agrees = agreeCount(comment.comment_actions)
  return (
    <div className="lc-comment" data-testid="comment-row" style={parent ? { marginLeft: 32 } : undefined}>
      <span className="lc-comment__avatar" />
      <div className="lc-comment__body">
        <div className="lc-comment__who"><AuthorLine comment={comment} /></div>
        {parent && <div className="lc-comment__meta" style={{ marginTop: 4 }}>↳ {(parent.profiles?.username ?? 'SYSTEM').toUpperCase()}</div>}
        <Body comment={comment} />
        <div className="lc-comment__actions">
          <button type="button" className={agreed ? 'is-on' : ''} onClick={onAgree} data-testid="agree-button" aria-pressed={agreed} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckThinIcon size={10} />AGREE {agrees}
          </button>
          <span className="sep" aria-hidden="true" />
          <button type="button" className={flagged ? 'is-on' : ''} onClick={onFlag} data-testid="flag-button" disabled={flagged} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <FlagIcon size={10} />{flagged ? 'FLAGGED' : 'FLAG'}
          </button>
          {comment.source !== 'auto' && (
            <>
              <span className="sep" aria-hidden="true" />
              <button type="button" onClick={onReply} data-testid="reply-button">REPLY</button>
            </>
          )}
          <span className="lc-comment__meta" style={{ marginTop: 0, marginLeft: 'auto' }}>{relativeTime(comment.created_at)}</span>
        </div>
      </div>
    </div>
  )
}
