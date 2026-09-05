'use client'

/**
 * Notifications page body (mobile-web handoff 27): "← NOTIFICATIONS · MARK ALL READ" back
 * row under the web header, then one row per notification — unread square, category
 * label, the sentence, time — and the footer below. Same data as the header popout
 * (GET /api/notifications; POST /api/notifications/read), rows presented through the
 * popout's presentNotification so copy matches everywhere. Tapping a row marks it read
 * and follows its link (offers open the thread, where ACCEPT / COUNTER live).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import { presentNotification, timeAgoShort, type NotificationItem } from '@/app/components/notifications-popout'

export default function NotificationsPage({ enabled, shippingLabelsEnabled }: { enabled: boolean; shippingLabelsEnabled: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loaded, setLoaded] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: NotificationItem[] }) => { if (!cancelled) { setItems(d.items ?? []); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [enabled])

  const unread = items.filter((n) => !n.read_at).length

  const markRead = (id?: string) => {
    const now = new Date().toISOString()
    setItems((xs) => xs.map((n) => (id && n.id !== id ? n : { ...n, read_at: n.read_at ?? now })))
    if (enabled) {
      fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      }).catch(() => {})
    }
  }

  const open = (n: NotificationItem) => {
    if (!n.read_at) markRead(n.id)
    if (n.url) router.push(n.url)
  }

  return (
    <main className="notif-page" data-testid="notifications-page">
      <div className="crumb crumb--bar">
        <span className="crumb__trail"><PrefetchLink href="/settings">SETTINGS</PrefetchLink> / NOTIFICATIONS</span>
        <span className="crumb__bar">
          <PrefetchLink href="/browse" className="crumb__back" aria-label="Back">←</PrefetchLink>
          <span className="crumb__title">NOTIFICATIONS</span>
          <span className="spacer" />
          <button type="button" className="link-underline crumb__action" onClick={() => markRead()} disabled={unread === 0}>MARK ALL READ</button>
        </span>
      </div>

      {items.length > 0 ? (
        <div className="nrows">
          {items.map((n) => {
            const p = presentNotification(n, { shippingLabels: shippingLabelsEnabled })
            const isUnread = !n.read_at
            return (
              <div
                key={n.id}
                className={`nrow${isUnread ? ' is-unread' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onKeyDown={(e) => { if (e.key === 'Enter') open(n) }}
                data-testid="notif-row"
              >
                <span className="nrow__mark">{isUnread && <span className="nrow__dot" />}</span>
                <span className="nrow__body">
                  <span className="nrow__tag">{p.tag}</span>
                  <span className="nrow__text">{p.title}</span>
                  {p.sub && <span className="nrow__sub">{p.sub}</span>}
                </span>
                <span className="nrow__time">{timeAgoShort(n.created_at)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty__title">{loaded ? 'You’re all caught up.' : 'Loading…'}</div>
          <div className="empty__sub">{enabled ? 'OFFERS, ORDERS AND ALERTS LAND HERE' : 'IN-APP NOTIFICATIONS ARRIVE WITH THE NOTIFICATIONS LAUNCH'}</div>
        </div>
      )}
    </main>
  )
}
