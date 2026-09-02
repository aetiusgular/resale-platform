/**
 * SiteHeader — shared authenticated page header.
 * Desktop: Wordmark (→ /), search (→ /browse?q=), Sell, Saved, Messages, avatar.
 * Mobile (<768px): Wordmark (→ /), search, avatar only — other links in tab bar.
 *
 * Text links only — no bordered SELL / filled SIGN UP pills (Grailed tell).
 */
import type { CSSProperties } from 'react'
import PrefetchLink from './prefetch-link'
import AvatarMenu from './avatar-menu'
import NotificationBell from './notification-bell'
import GuestAction from './guest-action'
import Wordmark from './wordmark'
import SearchField from './search-field'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'

interface Props {
  /** Empty string ⇒ signed-out visitor: the nav shows Sell + Sign in (both open the popup). */
  username: string
  /** Pre-fill the search input (e.g. when staying on browse after a search) */
  searchValue?: string
}

const textLink: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  fontWeight: 'var(--font-weight-regular)',
  color: 'var(--color-ink-soft)',
  textDecoration: 'underline',
  textDecorationThickness: '1px',
  textUnderlineOffset: '3px',
  textDecorationColor: 'var(--color-line)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  minHeight: '44px',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 2px',
  whiteSpace: 'nowrap',
}

const textLinkStrong: CSSProperties = {
  ...textLink,
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-ink)',
}

export default function SiteHeader({ username, searchValue = '' }: Props) {
  const initials = username.slice(0, 2).toUpperCase()
  const isGuest = !username

  return (
    <header className="page-inset" style={{
      height: '56px', borderBottom: '1px solid var(--color-line)',
      display: 'flex', alignItems: 'center', gap: '16px',
      background: 'var(--color-bg)',
    }}>
      <Wordmark />

      {/* Search — navigates to /browse; leading glass only, no SEARCH button */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <form
          action="/browse"
          method="get"
          style={{ width: '100%', maxWidth: '480px' }}
        >
          <SearchField defaultValue={searchValue} />
        </form>
      </div>

      {/* Right nav — underline text links, not pill buttons */}
      {isGuest ? (
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <GuestAction
            next="/sell"
            className="desktop-only motion-text-link"
            testId="header-sell-guest"
            style={textLink}
          >
            Sell
          </GuestAction>
          <GuestAction
            testId="header-signin"
            className="motion-text-link"
            style={textLinkStrong}
          >
            Sign in
          </GuestAction>
        </nav>
      ) : (
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <PrefetchLink
            href="/sell"
            className="desktop-only motion-text-link"
            style={{ ...textLink, textDecoration: 'underline' }}
          >
            Sell
          </PrefetchLink>
          <PrefetchLink
            href="/saved"
            className="desktop-only motion-text-link"
            style={{ ...textLink, textDecoration: 'none' }}
          >
            Saved
          </PrefetchLink>
          <PrefetchLink
            href="/messages"
            className="desktop-only motion-text-link"
            style={{ ...textLink, textDecoration: 'none' }}
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
