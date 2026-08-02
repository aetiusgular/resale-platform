/**
 * SiteHeader — shared authenticated page header.
 * Desktop: Wordmark (→ /), search (→ /browse?q=), Sell, SAVED, MESSAGES, avatar.
 * Mobile (<768px): Wordmark (→ /), search, avatar only — other links in tab bar.
 *
 * Server component: accepts preloaded user data so callers can avoid a
 * second DB round-trip.
 */
import Link from 'next/link'
import AvatarMenu from './avatar-menu'
import NotificationBell from './notification-bell'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

interface Props {
  username: string
  /** Pre-fill the search input (e.g. when staying on browse after a search) */
  searchValue?: string
}

export default function SiteHeader({ username, searchValue = '' }: Props) {
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <header style={{
      height: '56px', borderBottom: '1px solid var(--color-line)',
      display: 'flex', alignItems: 'center', gap: '16px', padding: '0 16px',
      background: 'var(--color-bg)',
    }}>
      {/* Wordmark */}
      <Link
        href="/"
        data-testid="site-wordmark"
        style={{
          font: '600 16px var(--font-ui)', letterSpacing: '0.08em',
          color: 'var(--color-ink)', textDecoration: 'none',
          flex: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center',
        }}
      >
        ———
      </Link>

      {/* Search — navigates to /browse */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <form
          action="/browse"
          method="get"
          style={{ width: '100%', maxWidth: '480px' }}
        >
          <input
            name="q"
            defaultValue={searchValue}
            placeholder="search designers, items"
            style={{
              width: '100%', height: '44px', boxSizing: 'border-box',
              border: '1px solid var(--color-line)', borderRadius: '2px',
              padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)',
              background: 'var(--color-bg)', outline: 'none',
            }}
          />
        </form>
      </div>

      {/* Right nav — desktop only links */}
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Link
          href="/sell"
          className="desktop-only"
          style={{
            display: 'inline-flex', alignItems: 'center',
            height: '44px', padding: '0 24px',
            background: 'var(--color-bg)', color: 'var(--color-ink)',
            border: '1px solid var(--color-ink)', borderRadius: '2px',
            font: '500 14px var(--font-ui)', textDecoration: 'none',
          }}
        >
          Sell
        </Link>
        <Link
          href="/saved"
          className="desktop-only"
          style={{
            font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--color-ink-soft)',
            textDecoration: 'none',
          }}
        >
          Saved
        </Link>
        <Link
          href="/messages"
          className="desktop-only"
          style={{
            font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--color-ink-soft)',
            textDecoration: 'none',
          }}
        >
          Messages
        </Link>
        {NOTIFICATIONS_ENABLED && <NotificationBell />}
        <AvatarMenu username={username} initials={initials} />
      </nav>
    </header>
  )
}
