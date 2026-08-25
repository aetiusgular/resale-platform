'use client'

import PrefetchLink from './prefetch-link'
import { usePathname } from 'next/navigation'

interface Props {
  username: string
  hasUnread?: boolean
}

export default function MobileTabBar({ username, hasUnread }: Props) {
  const pathname = usePathname()

  const tabs = [
    { label: 'FEED', href: '/', icon: feedIcon, match: (p: string) => p === '/' },
    { label: 'DISCOVER', href: '/browse', icon: discoverIcon, match: (p: string) => p.startsWith('/browse') },
    { label: 'SELL', href: '/sell', icon: sellIcon, match: (p: string) => p.startsWith('/sell') },
    { label: 'MESSAGES', href: '/messages', icon: messagesIcon, match: (p: string) => p.startsWith('/messages') },
    { label: 'PROFILE', href: `/sellers/${username}`, icon: profileIcon, match: (p: string) => p === `/sellers/${username}` },
  ]

  return (
    <nav
      data-testid="mobile-tabbar"
      className="mobile-only"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '56px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname)
        const color = active ? 'var(--color-ink)' : 'var(--color-ink-soft)'

        return (
          <PrefetchLink
            key={tab.label}
            href={tab.href}
            data-testid={`tab-${tab.label.toLowerCase()}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              flex: 1,
              height: '56px',
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke={color}
              strokeWidth={active ? '2' : '1.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {tab.icon(active)}
            </svg>
            {tab.label === 'MESSAGES' && hasUnread && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: 'calc(50% - 14px)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color,
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </PrefetchLink>
        )
      })}
    </nav>
  )
}

/* Simple 20px line icons — inline SVG paths, no icon library */

function feedIcon(active: boolean) {
  // Grid/home icon
  return active ? (
    <>
      <rect x="3" y="3" width="6" height="6" fill="var(--color-ink)" stroke="var(--color-ink)" />
      <rect x="11" y="3" width="6" height="6" fill="var(--color-ink)" stroke="var(--color-ink)" />
      <rect x="3" y="11" width="6" height="6" fill="var(--color-ink)" stroke="var(--color-ink)" />
      <rect x="11" y="11" width="6" height="6" fill="var(--color-ink)" stroke="var(--color-ink)" />
    </>
  ) : (
    <>
      <rect x="3" y="3" width="6" height="6" />
      <rect x="11" y="3" width="6" height="6" />
      <rect x="3" y="11" width="6" height="6" />
      <rect x="11" y="11" width="6" height="6" />
    </>
  )
}

function discoverIcon(active: boolean) {
  // Search/compass icon
  return (
    <>
      <circle cx="9" cy="9" r="5" fill={active ? 'var(--color-ink)' : 'none'} />
      <line x1="13" y1="13" x2="17" y2="17" />
    </>
  )
}

function sellIcon(active: boolean) {
  // Plus icon
  return (
    <>
      <circle cx="10" cy="10" r="7" fill={active ? 'var(--color-ink)' : 'none'} />
      <line x1="10" y1="7" x2="10" y2="13" stroke={active ? 'var(--color-bg)' : undefined} />
      <line x1="7" y1="10" x2="13" y2="10" stroke={active ? 'var(--color-bg)' : undefined} />
    </>
  )
}

function messagesIcon(active: boolean) {
  // Chat bubble icon
  return (
    <path
      d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z"
      fill={active ? 'var(--color-ink)' : 'none'}
    />
  )
}

function profileIcon(active: boolean) {
  // Person icon
  return (
    <>
      <circle cx="10" cy="7" r="3" fill={active ? 'var(--color-ink)' : 'none'} />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" fill={active ? 'var(--color-ink)' : 'none'} />
    </>
  )
}
