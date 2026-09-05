'use client'

/**
 * Notifications popout (design option 1A), anchored under the header avatar.
 * Real data: GET /api/notifications (30 most recent + unread count) when
 * NOTIFICATIONS_ENABLED; POST /api/notifications/read marks one/all read.
 * Rows are presented from the event `data` payload the way the reference does
 * ("New offer — $340" / "RAF SIMONS · BOMBER AW03 · FROM @WOVENPAST"); an unread
 * offer row carries inline ACCEPT / COUNTER / DECLINE that hit the offer routes.
 * When the flag is off the panel renders the empty state (no fetch).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon, CheckThinIcon } from './icons'
import { usePushStatus } from './push-subscribe'

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  data?: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export function timeAgoShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'NOW'
  if (mins < 60) return `${mins}M`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D`
  return `${Math.floor(days / 7)}W`
}

const money = (c: unknown) => (typeof c === 'number' ? `$${Math.round(c / 100).toLocaleString('en-US')}` : '')
const str = (v: unknown) => (typeof v === 'string' && v ? v : '')

type Presented = {
  tag: string
  title: string
  sub: string
  kind: 'tone' | 'init' | 'check'
  init?: string
  link?: string
  isOffer: boolean
  /** Offer rows only: ids for the inline actions. */
  offer?: { conversationId: string; offerId: string }
}

/** Reference row copy from the event payload; falls back to the stored title/body. */
export function presentNotification(n: NotificationItem, opts: { shippingLabels: boolean }): Presented {
  const d = n.data ?? {}
  const item = [str(d.brand).toUpperCase(), str(d.itemTitle).toUpperCase()].filter(Boolean).join(' · ') || str(d.itemTitle).toUpperCase()
  const actor = str(d.actorName) ? `@${str(d.actorName).toUpperCase()}` : ''
  const cid = str(d.conversationId)
  const oid = str(d.offerId)
  const offerIds = cid && oid ? { conversationId: cid, offerId: oid } : undefined
  const bodyUpper = n.body ? n.body.toUpperCase() : ''
  switch (n.type) {
    case 'offer_received':
      return { tag: 'OFFER', title: `New offer — ${money(d.amountCents)}`, sub: [item, actor && `FROM ${actor}`].filter(Boolean).join(' · ') || bodyUpper, kind: 'tone', isOffer: true, offer: offerIds }
    case 'offer_countered':
      return { tag: 'OFFER', title: `Counter received — ${money(d.amountCents)}`, sub: [item, actor].filter(Boolean).join(' · ') || bodyUpper, kind: 'tone', isOffer: true, offer: offerIds, link: 'VIEW OFFER →' }
    case 'offer_accepted':
      return { tag: 'OFFER', title: `Offer accepted — ${money(d.amountCents)}`, sub: [item, 'PAY WITHIN 24H'].filter(Boolean).join(' · '), kind: 'check', isOffer: false, link: 'CHECKOUT →' }
    case 'offer_declined':
      return { tag: 'OFFER', title: `Offer declined — ${money(d.amountCents)}`, sub: [item, actor].filter(Boolean).join(' · ') || bodyUpper, kind: 'tone', isOffer: false }
    case 'sale':
      return { tag: 'SOLD', title: `${str(d.itemTitle) || 'Item'} sold — ${money(d.amountCents)}`, sub: [actor && `BUYER ${actor}`, 'SHIP WITHIN 3 DAYS'].filter(Boolean).join(' · '), kind: 'tone', isOffer: false, link: opts.shippingLabels ? 'PRINT LABEL →' : 'VIEW ORDER →' }
    case 'message':
      return { tag: 'MESSAGE', title: `${actor ? actor.toLowerCase() : 'Someone'} replied`, sub: [str(d.preview) && `“${str(d.preview).slice(0, 60).toUpperCase()}”`, item].filter(Boolean).join(' · ') || bodyUpper, kind: 'init', init: str(d.actorName).slice(0, 2).toUpperCase() || '@', isOffer: false }
    case 'price_drop':
      return { tag: 'PRICE DROP', title: `Saved item now ${money(d.amountCents)}`, sub: [item, typeof d.oldAmountCents === 'number' ? `WAS ${money(d.oldAmountCents)}` : ''].filter(Boolean).join(' · ') || bodyUpper, kind: 'tone', isOffer: false }
    case 'listing_approved':
      return { tag: 'LISTING', title: 'Listing approved — now live', sub: item || bodyUpper, kind: 'check', isOffer: false }
    case 'shipped':
      return { tag: 'ORDER', title: 'On the way', sub: item || bodyUpper, kind: 'tone', isOffer: false, link: 'TRACK →' }
    case 'delivered':
      return { tag: 'ORDER', title: 'Delivered', sub: item || bodyUpper, kind: 'check', isOffer: false, link: 'LEAVE FEEDBACK →' }
    case 'dispute':
      return { tag: 'DISPUTE', title: n.title, sub: item || bodyUpper, kind: 'tone', isOffer: false, link: 'VIEW →' }
    case 'saved_search':
      return { tag: 'SEARCH ALERT', title: n.title, sub: [item, money(d.amountCents)].filter(Boolean).join(' · ') || bodyUpper, kind: 'tone', isOffer: false }
    case 'tier_expiry':
      return { tag: 'TIER', title: n.title, sub: bodyUpper, kind: 'tone', isOffer: false }
    case 'buyer_reward':
      return { tag: 'REWARD', title: n.title, sub: bodyUpper, kind: 'check', isOffer: false }
    case 'elite_program':
    case 'admin_elite_lead':
      return { tag: 'PROGRAM', title: n.title, sub: bodyUpper, kind: 'tone', isOffer: false }
    case 'moderator_granted':
      return { tag: 'MODERATOR', title: n.title, sub: bodyUpper, kind: 'check', isOffer: false }
    default:
      return { tag: n.type.replace(/_/g, ' ').toUpperCase(), title: n.title, sub: bodyUpper, kind: 'tone', isOffer: false }
  }
}

interface Props {
  open: boolean
  enabled: boolean
  shippingLabelsEnabled?: boolean
  items: NotificationItem[]
  onItems: (items: NotificationItem[]) => void
  onClose: () => void
}

export default function NotificationsPopout({ open, enabled, shippingLabelsEnabled = false, items, onItems, onClose }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [hidePrompt, setHidePrompt] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const { status: push, subscribe } = usePushStatus()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const unread = items.filter((i) => !i.read_at)
  const list = tab === 'unread' ? unread : items

  const markRead = (id?: string) => {
    const now = new Date().toISOString()
    onItems(items.map((n) => (id && n.id !== id ? n : { ...n, read_at: n.read_at ?? now })))
    if (enabled) {
      fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      }).catch(() => {})
    }
  }

  const openItem = (n: NotificationItem) => {
    if (!n.read_at) markRead(n.id)
    onClose()
    if (n.url) router.push(n.url)
  }

  const go = (to: string) => { onClose(); router.push(to) }

  // Inline offer actions (reference 1A): ACCEPT / DECLINE hit the offer routes;
  // COUNTER opens the thread with the counter composer pre-armed.
  async function offerAction(n: NotificationItem, p: Presented, action: 'accept' | 'counter' | 'decline') {
    if (!p.offer) { openItem(n); return }
    const { conversationId, offerId } = p.offer
    if (action === 'counter') {
      markRead(n.id)
      go(`/messages/${conversationId}?counter=${offerId}`)
      return
    }
    setBusy(n.id)
    const res = await fetch(`/api/conversations/${conversationId}/offers/${offerId}/${action}`, { method: 'POST' })
    setBusy(null)
    markRead(n.id)
    if (action === 'accept' && res.ok) {
      go(`/messages/${conversationId}`)
    } else if (!res.ok) {
      // Offer no longer open (expired / countered elsewhere) — the thread has the truth.
      go(`/messages/${conversationId}`)
    }
  }

  return (
    <>
      <div className="notif-overlay" onClick={onClose} />
      <div className="notif-panel" role="dialog" aria-label="Notifications" data-testid="notifications-panel">
        <div className="notif-panel__head">
          <span className="notif-panel__title">Notifications</span>
          <button type="button" className="link-underline link-underline--sm" onClick={() => markRead()} disabled={unread.length === 0}>
            MARK ALL READ
          </button>
        </div>
        <div className="notif-tabs">
          {(['all', 'unread'] as const).map((t) => (
            <button key={t} type="button" className={`tab-mono tab-mono--sm${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()} {pad(t === 'all' ? items.length : unread.length)}
            </button>
          ))}
        </div>

        {enabled && push === 'unsubscribed' && !hidePrompt && (
          <div className="push-prompt">
            <span className="push-prompt__icon"><BellIcon /></span>
            <div className="push-prompt__body">
              <div className="push-prompt__title">Turn on push alerts</div>
              <div className="push-prompt__sub">OFFERS, SALES AND ORDER UPDATES — AS THEY HAPPEN</div>
              <div className="push-prompt__actions">
                <button type="button" className="btn-mini btn-mini--solid" onClick={subscribe}>ENABLE PUSH</button>
                <button type="button" className="btn-mini btn-mini--link" onClick={() => setHidePrompt(true)}>NOT NOW</button>
              </div>
            </div>
          </div>
        )}
        {enabled && push === 'subscribed' && (
          <div className="push-on">
            <span className="push-on__tag">PUSH ON</span>
            <span className="push-on__sub">DELIVERED TO THIS DEVICE</span>
            <span className="spacer" />
            <button type="button" className="link-underline link-underline--sm" onClick={() => go('/settings/notifications')}>MANAGE</button>
          </div>
        )}

        {list.length > 0 ? (
          <div className="notif-scroll">
            {list.map((n) => {
              const p = presentNotification(n, { shippingLabels: shippingLabelsEnabled })
              const isUnread = !n.read_at
              const showActions = isUnread && p.isOffer && !!p.offer
              return (
                <div
                  key={n.id}
                  className={`notif-row${isUnread ? ' is-unread' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItem(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openItem(n) }}
                  data-testid="notif-row"
                >
                  {p.kind === 'tone' && <span className="notif-row__thumb" style={{ background: `var(--tone-${(n.id.charCodeAt(0) % 8) + 1})` }} />}
                  {p.kind === 'init' && <span className="notif-row__thumb notif-row__thumb--init">{p.init}</span>}
                  {p.kind === 'check' && <span className="notif-row__thumb notif-row__thumb--check"><CheckThinIcon /></span>}
                  <div className="notif-row__body">
                    <div className="notif-row__meta">
                      <span className="tag">{p.tag}</span>
                      <span className="spacer" />
                      <span className="notif-row__time">{timeAgoShort(n.created_at)}</span>
                    </div>
                    <div className="notif-row__title">{p.title}</div>
                    {p.sub && <div className="notif-row__sub">{p.sub}</div>}
                    {showActions && (
                      <div className="notif-row__actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn-mini btn-mini--solid" disabled={busy === n.id} onClick={() => offerAction(n, p, 'accept')}>ACCEPT</button>
                        <button type="button" className="btn-mini btn-mini--outline" disabled={busy === n.id} onClick={() => offerAction(n, p, 'counter')}>COUNTER</button>
                        <button type="button" className="btn-mini btn-mini--link" disabled={busy === n.id} onClick={() => offerAction(n, p, 'decline')}>DECLINE</button>
                      </div>
                    )}
                    {p.link && !showActions && n.url && (
                      <div className="notif-row__link"><span className="link-underline link-underline--ink">{p.link}</span></div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="notif-empty">
            <BellIcon size={24} />
            <div className="notif-empty__title">You&rsquo;re all caught up.</div>
            <div className="notif-empty__sub">OFFERS, ORDERS AND ALERTS LAND HERE</div>
          </div>
        )}

        <div className="notif-panel__foot">
          <button type="button" className="link-underline link-underline--ink" onClick={() => setTab('all')}>VIEW ALL →</button>
          <button type="button" className="link-underline" onClick={() => go('/settings/notifications')}>SETTINGS</button>
        </div>
      </div>
    </>
  )
}
