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
import { SellIcon, HeartIcon, ChatIcon } from './icons'
import AccountPopout from './account-popout'
import NotificationsPopout, { type NotificationItem } from './notifications-popout'
import { DEV_CHROME_VIEWER, useDevSignedInChrome } from './dev-signed-in-chrome'
import { PROTO_BASE } from '@/app/proto/viewer-fixture'

interface Props {
  username: string
  displayName?: string
  notificationsEnabled: boolean
  shippingLabelsEnabled?: boolean
  /**
   * Proto tour only (/styleguide/proto), passed by proto-header.tsx. Points every
   * nav link inside the tour and swaps the two live count fetches for fixtures, so
   * the walkthrough never lands on a gated route. Undefined on every real route —
   * this is display data, not a session, and no gate reads it.
   */
  proto?: { base: string; notifications: NotificationItem[]; messageCount: number }
}

export default function HeaderActions({ username: realUsername, displayName: realDisplayName, notificationsEnabled, shippingLabelsEnabled = false, proto }: Props) {
  const pathname = usePathname() ?? ''
  // Development, or NEXT_PUBLIC_PROTO_TOUR=1: draw the signed-in chrome for a guest
  // so SELL / SAVED / MESSAGES / account point at the proto tour. Display props only —
  // /sell, /saved, /messages, /settings and /orders keep their server-side gates and
  // still redirect a guest to /enter. See dev-signed-in-chrome.ts.
  const devChrome = useDevSignedInChrome() && !realUsername && !proto
  const username = devChrome ? DEV_CHROME_VIEWER.username : realUsername
  const displayName = devChrome ? DEV_CHROME_VIEWER.displayName : realDisplayName
  const isGuest = !username
  const initials = (displayName || username).slice(0, 2).toUpperCase()
  // Both header variants that render from fixtures point their nav at the proto
  // tour: the tour's own header via `proto`, and the development stand-in, whose
  // targets would otherwise be gated routes that bounce the visitor to /enter.
  const fixtureBase = proto?.base ?? (devChrome ? PROTO_BASE : undefined)
  const base = fixtureBase ?? ''

  // Which overlay is open, stamped with the pathname it was opened on — so a
  // navigation closes it without an effect (an overlay opened on another route
  // simply doesn't count as open here).
  const [overlay, setOverlay] = useState<{ which: 'acct' | 'notif' | null; path: string }>({ which: null, path: pathname })
  const acctOpen = overlay.which === 'acct' && overlay.path === pathname
  const notifOpen = overlay.which === 'notif' && overlay.path === pathname
  const setAcctOpen = useCallback((v: boolean) => setOverlay({ which: v ? 'acct' : null, path: pathname }), [pathname])
  const setNotifOpen = useCallback((v: boolean) => setOverlay({ which: v ? 'notif' : null, path: pathname }), [pathname])
  const [notifs, setNotifs] = useState<NotificationItem[]>(proto?.notifications ?? [])
  const [msgCount, setMsgCount] = useState(proto?.messageCount ?? 0)

  useEffect(() => {
    if (isGuest || devChrome || proto || !notificationsEnabled) return
    let cancelled = false
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: NotificationItem[] }) => { if (!cancelled) setNotifs(d.items ?? []) })
      .catch(() => { /* fail-soft: no badge */ })
    return () => { cancelled = true }
  }, [isGuest, devChrome, proto, notificationsEnabled])

  // MESSAGES badge — refetched on every navigation so opening a thread clears it.
  useEffect(() => {
    if (isGuest || devChrome || proto) return
    let cancelled = false
    fetch('/api/conversations/unread')
      .then((r) => (r.ok ? r.json() : { total: 0 }))
      .then((d: { total?: number }) => { if (!cancelled) setMsgCount(d.total ?? 0) })
      .catch(() => { /* fail-soft: no badge */ })
    return () => { cancelled = true }
  }, [isGuest, devChrome, proto, pathname])

  const closeAll = useCallback(() => setOverlay({ which: null, path: pathname }), [pathname])

  const unread = notifs.filter((n) => !n.read_at).length
  const active = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

  if (isGuest) {
    return (
      <div className="header__actions">
        <GuestAction next="/sell" className="nav-icon" testId="header-sell-guest">
          <span className="nav-icon__glyph"><SellIcon /></span>
          <span className="nav-icon__label" data-label="SELL">SELL</span>
        </GuestAction>
        <span className="header__divider" aria-hidden="true" />
        <GuestAction testId="browse-signin" className="btn-mini btn-mini--solid" style={{ letterSpacing: '0.16em', padding: '8px 12px' }}>
          SIGN IN
        </GuestAction>
      </div>
    )
  }

  return (
    <div className="header__actions" data-dev-chrome={devChrome ? '1' : undefined}>
      {/* Navbar pages preload eagerly: `prefetch` = full route + data as soon as the
          header renders, not on hover (production only; see prefetch-link.tsx). */}
      <PrefetchLink className={`nav-icon${active(`${base}/sell`) ? ' is-active' : ''}`} href={`${base}/sell`} prefetch>
        <span className="nav-icon__glyph"><SellIcon /></span>
        <span className="nav-icon__label" data-label="SELL">SELL</span>
      </PrefetchLink>
      <PrefetchLink className={`nav-icon${active(`${base}/saved`) ? ' is-active' : ''}`} href={`${base}/saved`} prefetch>
        <span className="nav-icon__glyph"><HeartIcon filled={false} size={15} /></span>
        <span className="nav-icon__label" data-label="SAVED">SAVED</span>
      </PrefetchLink>
      <PrefetchLink className={`nav-icon${active(`${base}/messages`) ? ' is-active' : ''}`} href={`${base}/messages`} aria-label={`Messages, ${msgCount} unread`} prefetch>
        <span className="nav-icon__glyph"><ChatIcon /></span>
        <span className="nav-icon__label" data-label="MESSAGES">MESSAGES</span>
        {/* In-flow after the label — never over the glyph or the reserved-width slot. */}
        <span className={`nav-icon__count${msgCount > 0 ? '' : ' is-empty'}`} data-testid="messages-badge" aria-hidden="true">
          {msgCount > 9 ? '9+' : msgCount > 0 ? msgCount : '0'}
        </span>
      </PrefetchLink>
      <span className="header__divider" aria-hidden="true" />
      <button
        type="button"
        className={`avatar${active(`${base}/settings`) || active(`${base}/orders`) ? ' is-active' : ''}`}
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
        protoBase={fixtureBase}
      />
      {/* `enabled` is the live-data switch: false in the tour keeps the push prompt
          and the mark-read POST off while the fixture rows still render. */}
      <NotificationsPopout
        open={notifOpen}
        enabled={notificationsEnabled && fixtureBase === undefined}
        shippingLabelsEnabled={shippingLabelsEnabled}
        items={notifs}
        onItems={setNotifs}
        onClose={closeAll}
        protoBase={fixtureBase}
      />
    </div>
  )
}
