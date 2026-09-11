'use client'

/**
 * Right cluster of the site header: SELL · SAVED · MESSAGES · avatar.
 * Guests get SELL (auth-gated) + a SIGN IN button; members get the nav icons and
 * the avatar, which opens the account popout (and from there the notifications
 * popout). The unread notification count (avatar badge) is fetched once on mount
 * when NOTIFICATIONS_ENABLED; the unread MESSAGES count comes from
 * /api/conversations/unread (conversation_reads cursors).
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import PrefetchLink from './prefetch-link'
import GuestAction from './guest-action'
import { SellIcon, BookmarkIcon, ChatIcon } from './icons'
import AccountPopout from './account-popout'
import NotificationsPopout, { type NotificationItem } from './notifications-popout'

interface Props {
  username: string
  displayName?: string
  notificationsEnabled: boolean
  shippingLabelsEnabled?: boolean
}

export default function HeaderActions({ username, displayName, notificationsEnabled, shippingLabelsEnabled = false }: Props) {
  const pathname = usePathname() ?? ''
  const isGuest = !username
  const initials = (displayName || username).slice(0, 2).toUpperCase()

  // Which overlay is open, stamped with the pathname it was opened on — so a
  // navigation closes it without an effect (an overlay opened on another route
  // simply doesn't count as open here).
  const [overlay, setOverlay] = useState<{ which: 'acct' | 'notif' | null; path: string }>({ which: null, path: pathname })
  const acctOpen = overlay.which === 'acct' && overlay.path === pathname
  const notifOpen = overlay.which === 'notif' && overlay.path === pathname
  const setAcctOpen = useCallback((v: boolean) => setOverlay({ which: v ? 'acct' : null, path: pathname }), [pathname])
  const setNotifOpen = useCallback((v: boolean) => setOverlay({ which: v ? 'notif' : null, path: pathname }), [pathname])
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [msgCount, setMsgCount] = useState(0)

  useEffect(() => {
    if (isGuest || !notificationsEnabled) return
    let cancelled = false
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: NotificationItem[] }) => { if (!cancelled) setNotifs(d.items ?? []) })
      .catch(() => { /* fail-soft: no badge */ })
    return () => { cancelled = true }
  }, [isGuest, notificationsEnabled])

  // MESSAGES badge — refetched on every navigation so opening a thread clears it.
  useEffect(() => {
    if (isGuest) return
    let cancelled = false
    fetch('/api/conversations/unread')
      .then((r) => (r.ok ? r.json() : { total: 0 }))
      .then((d: { total?: number }) => { if (!cancelled) setMsgCount(d.total ?? 0) })
      .catch(() => { /* fail-soft: no badge */ })
    return () => { cancelled = true }
  }, [isGuest, pathname])

  const closeAll = useCallback(() => setOverlay({ which: null, path: pathname }), [pathname])

  const unread = notifs.filter((n) => !n.read_at).length
  const active = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

  if (isGuest) {
    return (
      <div className="header__actions">
        <GuestAction next="/sell" className="nav-icon" testId="header-sell-guest">
          <SellIcon />
          <span className="nav-icon__label">SELL</span>
        </GuestAction>
        <span className="header__divider" aria-hidden="true" />
        <GuestAction testId="browse-signin" className="btn-mini btn-mini--solid" style={{ letterSpacing: '0.16em', padding: '8px 12px' }}>
          SIGN IN
        </GuestAction>
      </div>
    )
  }

  return (
    <div className="header__actions">
      {/* Navbar pages preload eagerly: `prefetch` = full route + data as soon as the
          header renders, not on hover (production only; see prefetch-link.tsx). */}
      <PrefetchLink className={`nav-icon${active('/sell') ? ' is-active' : ''}`} href="/sell" prefetch>
        <SellIcon />
        <span className="nav-icon__label">SELL</span>
      </PrefetchLink>
      <PrefetchLink className={`nav-icon${active('/saved') ? ' is-active' : ''}`} href="/saved" prefetch>
        <BookmarkIcon />
        <span className="nav-icon__label">SAVED</span>
      </PrefetchLink>
      <PrefetchLink className={`nav-icon${active('/messages') ? ' is-active' : ''}`} href="/messages" aria-label={`Messages, ${msgCount} unread`} prefetch>
        <span className="nav-icon__glyph">
          <ChatIcon />
          {msgCount > 0 && <span className="nav-icon__count" data-testid="messages-badge">{msgCount > 9 ? '9+' : msgCount}</span>}
        </span>
        <span className="nav-icon__label">MESSAGES</span>
      </PrefetchLink>
      <span className="header__divider" aria-hidden="true" />
      <button
        type="button"
        className={`avatar${active('/settings') || active('/orders') ? ' is-active' : ''}`}
        onClick={() => setAcctOpen(!acctOpen)}
        aria-label={`Account, ${unread} notifications`}
        aria-expanded={acctOpen}
        data-testid="avatar-btn"
      >
        <span className="avatar__box">{initials}</span>
        {unread > 0 && <span className="avatar__count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      <AccountPopout
        open={acctOpen}
        username={username}
        displayName={displayName}
        initials={initials}
        notifCount={unread}
        onClose={closeAll}
        onNotifications={() => { setAcctOpen(false); setNotifOpen(true) }}
      />
      <NotificationsPopout
        open={notifOpen}
        enabled={notificationsEnabled}
        shippingLabelsEnabled={shippingLabelsEnabled}
        items={notifs}
        onItems={setNotifs}
        onClose={closeAll}
      />
    </div>
  )
}
