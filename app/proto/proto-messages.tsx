'use client'

import { useCallback, useRef, useState } from 'react'
import InboxList from '@/app/messages/inbox-list'
import PrefetchLink from '@/app/components/prefetch-link'
import { ArrowLeftIcon, PaperclipIcon, XIcon } from '@/app/components/icons'
import { getProtoThread, PROTO_THREADS } from './messages-fixtures'

/** Fixture inbox + thread. Digest alignment is a later design pass. */
export default function ProtoMessages({ hrefBase, threadId }: { hrefBase: string; threadId?: string }) {
  const rows = PROTO_THREADS.map((t) => ({ ...t, id: t.id }))
  const thread = threadId ? getProtoThread(threadId) : undefined

  return (
    // `msgs--thread` is what swaps the inbox for the conversation below 720px,
    // the same as the live /messages/[id] page. Inbox-only hides the empty pane.
    <div className={`msgs${thread ? ' msgs--thread' : ' msgs--inbox'}`}>
      <InboxList
        rows={rows.map((t) => ({ ...t }))}
        activeId={threadId}
        hrefBase={`${hrefBase}/messages`}
      />
      {thread && (
        <div className="thread">
          <div className="thread__bar">
            <PrefetchLink href={`${hrefBase}/messages`} className="thread__back" aria-label="Back to inbox">
              <ArrowLeftIcon size={14} />
            </PrefetchLink>
            <span className="thread__handle">@{thread.handle.toUpperCase()}</span>
          </div>
          <div className="listing-strip">
            <span className="listing-strip__thumb" style={{ background: 'var(--tone-2)' }} />
            <span className="listing-strip__main">
              <span className="listing-strip__title">{thread.brand} — {thread.title}</span>
              <span className="listing-strip__price">{thread.price}</span>
              <span className="listing-strip__m">{thread.price}</span>
            </span>
          </div>
          <div className="thread__scroll">
            {thread.lines.map((line, i) => (
              line.kind === 'offer' ? (
                <div key={i} className={`offer-line${line.mine ? ' offer-line--mine' : ''}`}>
                  <span className="offer-line__label">Offer</span>
                  <span className="offer-line__amt">{line.amount ?? line.body}</span>
                  {line.state && <span className="offer-line__state">{line.state}</span>}
                  {!line.mine && thread.role === 'SELLING' && (
                    <span className="offer-line__actions">
                      <button type="button">Accept</button>
                      <button type="button">Counter</button>
                      <button type="button">Decline</button>
                    </span>
                  )}
                </div>
              ) : (
                <div key={i} className={`bubble-wrap ${line.mine ? 'bubble-wrap--me' : 'bubble-wrap--them'}`}>
                  <div className={`bubble ${line.mine ? 'bubble--me' : 'bubble--them'}`}>{line.body}</div>
                </div>
              )
            ))}
          </div>
          <ProtoCompose handle={thread.handle} />
        </div>
      )}
    </div>
  )
}

/**
 * Compose, fixture-only. The field and the attach control are real UI — nothing
 * is sent and nothing is uploaded; picked files become local thumbnails so the
 * layout can be judged with attachments present. The live thread owns the real
 * send/upload path.
 */
function ProtoCompose({ handle }: { handle: string }) {
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<Array<{ id: string; name: string; url: string }>>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const grow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return
    const next = Array.from(files)
      .slice(0, 4 - photos.length)
      .map((f) => ({ id: `${f.name}-${f.lastModified}`, name: f.name, url: URL.createObjectURL(f) }))
    setPhotos((prev) => [...prev, ...next])
  }

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  const clear = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])
    setBody('')
  }

  const canSend = body.trim().length > 0 || photos.length > 0

  return (
    <form
      className="thread__composer"
      data-testid="proto-composer"
      onSubmit={(e) => { e.preventDefault(); clear() }}
    >
      <button
        type="button"
        className="compose__attach"
        aria-label="Attach a photo"
        onClick={() => fileRef.current?.click()}
      >
        <PaperclipIcon />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }}
      />
      <div className="compose__field">
        <textarea
          className="compose__input"
          rows={1}
          value={body}
          placeholder={`Message @${handle}`}
          aria-label={`Message @${handle}`}
          data-testid="proto-compose-input"
          onChange={(e) => { setBody(e.target.value); grow(e.currentTarget) }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention people expect.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) clear() }
          }}
        />
        {photos.length > 0 && (
          <div className="compose__attached">
            {photos.map((p) => (
              <span key={p.id} className="compose__chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="compose__chip-thumb" src={p.url} alt="" style={{ objectFit: 'cover' }} />
                {p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name}
                <button type="button" className="compose__chip-rm" aria-label={`Remove ${p.name}`} onClick={() => removePhoto(p.id)}>
                  <XIcon size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="submit" className="btn-send" disabled={!canSend}>SEND</button>
    </form>
  )
}
