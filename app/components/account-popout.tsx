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
}

export default function AccountPopout({ open, username, displayName, initials, notifCount, onClose, onNotifications }: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  // Mobile web (handoff 27): notifications are a full page, reached from here.
  const compact = useCompact()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function signOut() {
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
            <PrefetchLink className="acct-panel__profile" href="/settings" onClick={onClose}>VIEW PROFILE</PrefetchLink>
          </span>
        </div>
        <nav className="acct-panel__nav">
          {compact ? (
            <PrefetchLink className="acct-row" href="/notifications" onClick={onClose} data-testid="acct-notifications">
              <span className="acct-row__label"><Bell size={16} aria-hidden="true" />Notifications</span>
              {notifCount > 0 && <span className="acct-row__badge">{notifCount}</span>}
            </PrefetchLink>
          ) : (
            <button type="button" className="acct-row" onClick={onNotifications} data-testid="acct-notifications">
              <span className="acct-row__label"><Bell size={16} aria-hidden="true" />Notifications</span>
              {notifCount > 0 && <span className="acct-row__badge">{notifCount}</span>}
            </button>
          )}
          <PrefetchLink className="acct-row" href="/settings/orders" onClick={onClose}><span className="acct-row__label"><Package size={16} aria-hidden="true" />Orders</span></PrefetchLink>
          <PrefetchLink className="acct-row" href="/settings" onClick={onClose}><span className="acct-row__label"><GearSix size={16} aria-hidden="true" />Settings</span></PrefetchLink>
        </nav>
        <div className="acct-panel__foot">
          <div className="acct-theme">
            <span className="acct-theme__label">THEME</span>
            <ThemeSegment options={['light', 'dark']} compact />
          </div>
          <button type="button" className="acct-signout" onClick={signOut} disabled={signingOut} data-testid="logout-btn">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </>
  )
}
