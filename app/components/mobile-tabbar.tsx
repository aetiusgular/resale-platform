'use client'

import PrefetchLink from './prefetch-link'
import { usePathname } from 'next/navigation'
import { useAuthModal } from './auth-modal-provider'
import Icon, { type IconName } from './icon'
import { useStudio } from './studio'

interface Props {
  /** Empty string ⇒ signed-out visitor: Sell / Messages / Profile open the popup. */
  username: string
  hasUnread?: boolean
  /** Lab only — sit in document flow instead of the viewport bottom. */
  pinned?: boolean
}

export default function MobileTabBar({ username, hasUnread, pinned = true }: Props) {
  const pathname = usePathname()
  const { openAuthModal } = useAuthModal()
  const { nav } = useStudio()
  const isGuest = !username

  const tabs: { label: string; href: string; match: (p: string) => boolean; auth: boolean; testId: string; icon: IconName }[] = [
    { label: 'Feed', href: '/browse', match: (p) => p === '/' || p === '/browse', auth: false, testId: 'tab-feed', icon: 'feed' },
    { label: 'Saved', href: '/saved', match: (p) => p.startsWith('/saved'), auth: true, testId: 'tab-saved', icon: 'save' },
    { label: 'Sell', href: '/sell', match: (p) => p.startsWith('/sell'), auth: true, testId: 'tab-sell', icon: 'sell' },
    { label: 'Messages', href: '/messages', match: (p) => p.startsWith('/messages'), auth: true, testId: 'tab-messages', icon: 'messages' },
    { label: 'You', href: username ? `/sellers/${username}` : '/settings', match: (p) => p === `/sellers/${username}` || p.startsWith('/settings'), auth: true, testId: 'tab-profile', icon: 'you' },
  ]

  const tabClass = (active: boolean) => `tabbar-link${active ? ' is-active' : ''}`

  const tabStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
    height: '56px',
    textDecoration: 'none',
    position: 'relative',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
  }

  return (
    <nav
      data-testid="mobile-tabbar"
      className={pinned ? 'mobile-only' : undefined}
      style={{
        position: pinned ? 'fixed' : 'relative',
        bottom: pinned ? 0 : undefined,
        left: pinned ? 0 : undefined,
        right: pinned ? 0 : undefined,
        height: '56px',
        paddingBottom: pinned ? 'env(safe-area-inset-bottom, 0px)' : 0,
        background: 'var(--color-bg)',
        borderTop: pinned ? '1px solid var(--color-line)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname)
        const color = active ? 'var(--color-ink)' : 'var(--color-ink-soft)'

        const label = (
          <>
            {tab.label === 'Messages' && hasUnread && (
              <span
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 'calc(50% - 14px)',
                  width: 5,
                  height: 5,
                  background: 'var(--color-ink)',
                }}
              />
            )}
            {nav !== 'text' && (
              <span style={{ color, display: 'flex' }}>
                <Icon name={tab.icon} size={20} />
              </span>
            )}
            {nav !== 'icon' && (
              <span style={{ color, fontWeight: active ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)' }}>{tab.label}</span>
            )}
          </>
        )

        if (isGuest && tab.auth) {
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => openAuthModal(tab.href)}
              data-testid={tab.testId}
              className={tabClass(active)}
              style={tabStyle}
            >
              {label}
            </button>
          )
        }

        return (
          <PrefetchLink
            key={tab.label}
            href={tab.href}
            data-testid={tab.testId}
            className={tabClass(active)}
            style={tabStyle}
          >
            {label}
          </PrefetchLink>
        )
      })}
    </nav>
  )
}
