'use client'

/**
 * Mobile tab bar (≤767px): BROWSE · SAVED · SELL · MESSAGES · ACCOUNT.
 * `auth` tabs require a session — for a guest they open the sign-in popup
 * instead of navigating. Hidden on desktop via the .mobile-only utility.
 */
import PrefetchLink from './prefetch-link'
import { usePathname } from 'next/navigation'
import { useAuthModal } from './auth-modal-provider'
import { GridIcon, BookmarkIcon, SellIcon, ChatIcon, UserIcon } from './icons'

interface Props {
  /** Empty string ⇒ signed-out visitor: Saved / Sell / Messages / Account open the popup. */
  username: string
  hasUnread?: boolean
}

export default function MobileTabBar({ username, hasUnread }: Props) {
  const pathname = usePathname() ?? ''
  const { openAuthModal } = useAuthModal()
  const isGuest = !username

  const tabs = [
    { label: 'BROWSE', href: '/browse', icon: <GridIcon />, match: (p: string) => p === '/' || p.startsWith('/browse') || p.startsWith('/listings'), auth: false },
    { label: 'SAVED', href: '/saved', icon: <BookmarkIcon />, match: (p: string) => p.startsWith('/saved'), auth: true },
    { label: 'SELL', href: '/sell', icon: <SellIcon />, match: (p: string) => p.startsWith('/sell'), auth: true },
    { label: 'MESSAGES', href: '/messages', icon: <ChatIcon />, match: (p: string) => p.startsWith('/messages'), auth: true },
    { label: 'ACCOUNT', href: '/settings', icon: <UserIcon />, match: (p: string) => p.startsWith('/settings') || p.startsWith('/orders'), auth: true },
  ]

  return (
    <nav data-testid="mobile-tabbar" className="tabbar mobile-only" aria-label="Primary">
      {tabs.map((tab) => {
        const active = tab.match(pathname)
        const cls = `tabbar__btn${active ? ' is-active' : ''}`
        const testId = `tab-${tab.label.toLowerCase()}`
        const inner = (
          <>
            {tab.icon}
            {tab.label === 'MESSAGES' && hasUnread && <span className="tabbar__dot" />}
            <span className="tabbar__label">{tab.label}</span>
          </>
        )
        if (isGuest && tab.auth) {
          return (
            <button key={tab.label} type="button" className={cls} onClick={() => openAuthModal(tab.href)} data-testid={testId}>
              {inner}
            </button>
          )
        }
        return (
          <PrefetchLink key={tab.label} href={tab.href} className={cls} data-testid={testId}>
            {inner}
          </PrefetchLink>
        )
      })}
    </nav>
  )
}
