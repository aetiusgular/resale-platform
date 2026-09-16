'use client'

/**
 * Account popout under the header avatar (reference AccountPopout): avatar +
 * name + VIEW PROFILE (→ settings), Notifications (badge), Orders, Settings,
 * THEME light/dark, Sign out. Sign out clears the Supabase session and lands on
 * /enter (the old avatar-menu contract, testids preserved for e2e).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import PrefetchLink from './prefetch-link'
import { ThemeSegment } from './theme'
import { Bell, Package, GearSix } from '@phosphor-icons/react/ssr'
import { useCompact } from './use-compact'

interface Props {
  open: boolean
  username: string
  displayName?: string
  initials: string
  notifCount: number
  onClose: () => void
  onNotifications: () => void
  /**
   * Proto tour only (/styleguide/proto): prefix the destinations so the popout
   * opens the fixture settings/orders screens, and make Sign out a no-op close —
   * there is no session to end. Undefined on every real route.
   */
  protoBase?: string
}

export default function AccountPopout({ open, username, displayName, initials, notifCount, onClose, onNotifications, protoBase }: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const demo = protoBase !== undefined
  const base = protoBase ?? ''
  // Mobile web (handoff 27): notifications are a full page, reached from here.
  // The tour has no notifications page, so it keeps the desktop popout at every width.
  const compact = useCompact() && !demo

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Navbar pages preload eagerly: the popout's targets are full-prefetched when the
  // header mounts, since the links below only exist while the menu is open.
  // router.prefetch defaults to a full prefetch; Next skips it in dev and for bots.
  useEffect(() => {
    router.prefetch(`${base}/settings`)
    router.prefetch(`${base}/settings/orders`)
    if (compact) router.prefetch('/notifications')
  }, [router, compact, base])

  if (!open) return null

  async function signOut() {
    if (demo) { onClose(); return }
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/enter')
    router.refresh()
  }

  return (
    <>
      <div className="notif-overlay" onClick={onClose} />
      <div className="acct-panel" role="dialog" aria-label="Account" data-testid="avatar-menu">
        <div className="acct-panel__head">
          <span className="acct-panel__avatar">{initials}</span>
          <span className="acct-panel__id">
            <span className="acct-panel__name">{displayName || `@${username}`}</span>
            <PrefetchLink className="acct-panel__profile" href={`${base}/settings`} onClick={onClose} prefetch>VIEW PROFILE</PrefetchLink>
          </span>
        </div>
        <nav className="acct-panel__nav">
          {compact ? (
            <PrefetchLink className="acct-row" href="/notifications" onClick={onClose} data-testid="acct-notifications" prefetch>
              <span className="acct-row__label"><Bell size={16} aria-hidden="true" />Notifications</span>
              {notifCount > 0 && <span className="acct-row__badge">{notifCount}</span>}
            </PrefetchLink>
          ) : (
            <button type="button" className="acct-row" onClick={onNotifications} data-testid="acct-notifications">
              <span className="acct-row__label"><Bell size={16} aria-hidden="true" />Notifications</span>
              {notifCount > 0 && <span className="acct-row__badge">{notifCount}</span>}
            </button>
          )}
          <PrefetchLink className="acct-row" href={`${base}/settings/orders`} onClick={onClose} prefetch><span className="acct-row__label"><Package size={16} aria-hidden="true" />Orders</span></PrefetchLink>
          <PrefetchLink className="acct-row" href={`${base}/settings`} onClick={onClose} prefetch><span className="acct-row__label"><GearSix size={16} aria-hidden="true" />Settings</span></PrefetchLink>
        </nav>
        <div className="acct-panel__foot">
          <div className="acct-theme">
            <span className="acct-theme__label">THEME</span>
            <ThemeSegment options={['light', 'dark', 'system']} compact />
          </div>
          <button type="button" className="acct-signout" onClick={signOut} disabled={signingOut} data-testid="logout-btn">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </>
  )
}
