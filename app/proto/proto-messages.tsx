'use client'

import InboxList from '@/app/messages/inbox-list'
import PrefetchLink from '@/app/components/prefetch-link'
import { ChatIcon } from '@/app/components/icons'
import { getProtoThread, PROTO_THREADS } from './messages-fixtures'

/** Fixture inbox + thread. Digest alignment is a later design pass. */
export default function ProtoMessages({ hrefBase, threadId }: { hrefBase: string; threadId?: string }) {
  const rows = PROTO_THREADS.map((t) => ({ ...t, id: t.id }))
  const thread = threadId ? getProtoThread(threadId) : undefined

  return (
    <div className="msgs">
      <InboxList
        rows={rows.map((t) => ({ ...t }))}
        activeId={threadId}
        hrefBase={`${hrefBase}/messages`}
      />
      <div className="thread">
        {thread ? (
          <>
            <div className="thread__bar">
              <PrefetchLink href={`${hrefBase}/messages`} className="thread__back" aria-label="Back to inbox">←</PrefetchLink>
              <span className="thread__handle">@{thread.handle.toUpperCase()}</span>
            </div>
            <div className="listing-strip">
              <span className="listing-strip__thumb" style={{ background: 'var(--tone-2)' }} />
              <span>
                <span className="listing-strip__title">{thread.brand} — {thread.title}</span>
                <span className="listing-strip__m">{thread.price}</span>
              </span>
            </div>
            <div className="thread__scroll">
              {thread.lines.map((line, i) => (
                <div key={i} className={`bubble-wrap ${line.mine ? 'bubble-wrap--me' : 'bubble-wrap--them'}`}>
                  <div className={`bubble ${line.mine ? 'bubble--me' : 'bubble--them'}`}>{line.body}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty" style={{ margin: 'auto', color: 'var(--faint)' }}>
            <ChatIcon />
            <div className="empty__title" style={{ paddingTop: 12 }}>Select a conversation</div>
          </div>
        )}
      </div>
    </div>
  )
}
