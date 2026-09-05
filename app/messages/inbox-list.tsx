'use client'

/**
 * Messages sidebar (design 1A): title + "n UNREAD" / "ALL READ", ALL / BUYING /
 * SELLING filters + conversation rows with unread badges. Rows are real links
 * (/messages/[id]); the active one is highlighted with the ink rail.
 */
import { useState } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import type { InboxRow } from '@/lib/loaders/inbox'

type RoleFilter = 'ALL' | 'BUYING' | 'SELLING'

export function inboxTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'NOW'
  if (mins < 60) return `${mins}M`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D`
  return `${Math.floor(days / 7)}W`
}

export default function InboxList({ rows, activeId }: { rows: InboxRow[]; activeId?: string }) {
  const [filter, setFilter] = useState<RoleFilter>('ALL')
  const list = rows.filter((c) => filter === 'ALL' || c.role === filter)
  // The open thread is read by definition (the page marks it on render).
  const unreadConvs = rows.filter((c) => c.unread > 0 && c.id !== activeId).length

  return (
    <aside className="msgs__list" data-testid="inbox-list">
      <div className="msgs__head">
        <h1 className="page-title page-title--sm">Messages</h1>
        <span className="page-note" data-testid="inbox-unread">{unreadConvs ? `${unreadConvs} UNREAD` : 'ALL READ'}</span>
      </div>
      <div className="msgs__filters" role="tablist">
        {(['ALL', 'BUYING', 'SELLING'] as RoleFilter[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={`tab-mono tab-mono--sm${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="msgs__scroll">
        {list.length === 0 && (
          <div className="empty" style={{ padding: '40px 24px' }}>
            <div className="empty__title">No conversations yet.</div>
            <div className="empty__sub">START ONE FROM A LISTING — MESSAGE SELLER OR MAKE OFFER</div>
          </div>
        )}
        {list.map((c, i) => {
          const unread = c.id === activeId ? 0 : c.unread
          return (
            <PrefetchLink key={c.id} className={`conv${activeId === c.id ? ' is-active' : ''}${unread ? ' is-unread' : ''}`} href={`/messages/${c.id}`} data-testid="inbox-row">
              {/* ≤720px (mobile-web 07): initials left, the listing thumb moves to the right */}
              <span className={`conv__avatar${unread ? ' is-unread' : ''}`} aria-hidden="true">{c.handle.slice(0, 2).toUpperCase()}</span>
              <span className="conv__thumb" style={{ background: `var(--tone-${(i % 8) + 1})`, overflow: 'hidden' }}>
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </span>
              <span className="conv__body">
                <span className="conv__top">
                  <span className="conv__handle">@{c.handle}</span>
                  <span className="tag">{c.role}</span>
                  <span className="conv__time conv__time--m">{inboxTime(c.updated_at)}</span>
                </span>
                <span className={`conv__preview${unread ? ' is-unread' : ''}`}>{c.previewMine ? 'You: ' : ''}{c.preview}</span>
                <span className="conv__listing">{c.brand.toUpperCase()} · {c.price}{c.status === 'sold' ? ' · SOLD' : ''}</span>
              </span>
              <span className="conv__side">
                <span className="conv__time">{inboxTime(c.updated_at)}</span>
                {unread > 0 && <span className="conv__badge" data-testid="conv-badge">{unread}</span>}
              </span>
            </PrefetchLink>
          )
        })}
      </div>
    </aside>
  )
}
