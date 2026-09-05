/**
 * SiteHeader — the shared chrome (design nav 16A / 6A): wordmark + stage badge,
 * underline search, SELL · SAVED · MESSAGES, avatar → account / notifications
 * popouts. Sticky. Collapses to a two-row header ≤720px (search drops below).
 *
 * Server component: accepts the preloaded username so callers avoid a second
 * DB round-trip. Empty username ⇒ signed-out visitor (SELL + SIGN IN open the
 * auth popup).
 */
import { Suspense } from 'react'
import PrefetchLink from './prefetch-link'
import HeaderSearch from './header-search'
import HeaderActions from './header-actions'
import { NOTIFICATIONS_ENABLED, SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { BRAND_STAGE, BRAND_WORDMARK } from './brand'
import { getViewer } from './viewer'

interface Props {
  /** Empty string ⇒ signed-out visitor. */
  username: string
  /** Optional display name (Settings → Profile) for the avatar initials + popout. */
  displayName?: string
  /** Pre-fill the search input (e.g. when staying on browse after a search). */
  searchValue?: string
}

export function Wordmark({ href = '/', small, testId }: { href?: string; small?: boolean; testId?: string }) {
  return (
    <PrefetchLink className={small ? 'footer__brand' : 'header__brand'} href={href} title="Home" data-testid={testId}>
      <span className={small ? 'footer__logo' : 'header__logo'}>{BRAND_WORDMARK}</span>
      <span className="header__alpha">{BRAND_STAGE}</span>
    </PrefetchLink>
  )
}

export default async function SiteHeader({ username, displayName, searchValue = '' }: Props) {
  // Avatar initials come from the display name everywhere (reference "JD"); pages
  // that didn't load it get it here, memoised per request.
  const resolvedDisplayName = displayName !== undefined ? displayName : username ? (await getViewer()).displayName ?? undefined : undefined
  return (
    <header className="header">
      <Wordmark testId="site-wordmark" />
      {/* useSearchParams inside → needs a Suspense boundary for static shells */}
      <Suspense fallback={<div className="search" aria-hidden="true" />}>
        <HeaderSearch defaultValue={searchValue} />
      </Suspense>
      <HeaderActions username={username} displayName={resolvedDisplayName} notificationsEnabled={NOTIFICATIONS_ENABLED} shippingLabelsEnabled={SHIPPING_LABELS_ENABLED} />
    </header>
  )
}
