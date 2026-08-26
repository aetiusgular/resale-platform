/**
 * SiteHeader — shared authenticated page header.
 * Desktop: Wordmark (→ /), search (→ /browse?q=), Sell, SAVED, MESSAGES, avatar.
 * Mobile (<768px): Wordmark (→ /), search, avatar only — other links in tab bar.
 *
 * Server component: accepts preloaded user data so callers can avoid a
 * second DB round-trip.
 */
import PrefetchLink from './prefetch-link'
import AvatarMenu from './avatar-menu'
import NotificationBell from './notification-bell'
import GuestAction from './guest-action'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

interface Props {
  /** Empty string ⇒ signed-out visitor: the nav shows Sell + Sign in (both open the popup). */
  username: string
  /** Pre-fill the search input (e.g. when staying on browse after a search) */
  searchValue?: string
}

export default function SiteHeader({ username, searchValue = '' }: Props) {
  const initials = username.slice(0, 2).toUpperCase()
  const isGuest = !username

  return (
    <header style={{
      height: '56px', borderBottom: '1px solid var(--color-line)',
      display: 'flex', alignItems: 'center', gap: '16px', padding: '0 16px',
      background: 'var(--color-bg)',
    }}>
      {/* Wordmark */}
      <PrefetchLink
        href="/"
        data-testid="site-wordmark"
        style={{
          font: '600 16px var(--font-ui)', letterSpacing: '0.08em',
          color: 'var(--color-ink)', textDecoration: 'none',
          flex: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center',
        }}
      >
        ———
      </PrefetchLink>

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

      {/* Right nav */}
      {isGuest ? (
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <GuestAction
            next="/sell"
            className="desktop-only"
            testId="header-sell-guest"
            style={{
              display: 'inline-flex', alignItems: 'center',
              height: '44px', padding: '0 24px',
              background: 'var(--color-bg)', color: 'var(--color-ink)',
              border: '1px solid var(--color-ink)', borderRadius: '2px',
              font: '500 14px var(--font-ui)',
            }}
          >
            Sell
          </GuestAction>
          <GuestAction
            testId="header-signin"
            style={{
              display: 'inline-flex', alignItems: 'center',
              height: '44px', padding: '0 24px',
              background: 'var(--color-ink)', color: 'var(--color-bg)',
              border: '1px solid var(--color-ink)', borderRadius: '2px',
              font: '500 14px var(--font-ui)', whiteSpace: 'nowrap',
            }}
          >
            Sign in
          </GuestAction>
        </nav>
      ) : (
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <PrefetchLink
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
          </PrefetchLink>
          <PrefetchLink
            href="/saved"
            className="desktop-only"
            style={{
              font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-ink-soft)',
              textDecoration: 'none',
            }}
          >
            Saved
          </PrefetchLink>
          <PrefetchLink
            href="/messages"
            className="desktop-only"
            style={{
              font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-ink-soft)',
              textDecoration: 'none',
            }}
          >
            Messages
          </PrefetchLink>
          {NOTIFICATIONS_ENABLED && <NotificationBell />}
          <AvatarMenu username={username} initials={initials} />
        </nav>
      )}
    </header>
  )
}
