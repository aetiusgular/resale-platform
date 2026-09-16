/**
 * SiteHeader — the shared chrome (design nav 16A / 6A): wordmark,
 * underline search, SELL · SAVED · MESSAGES, avatar → account / notifications
 * popouts. Sticky. Collapses to a two-row header ≤720px (search drops below).
 *
 * Server component: accepts the preloaded username so callers avoid a second
 * DB round-trip. Empty username ⇒ signed-out visitor (SELL + SIGN IN open the
 * auth popup).
 */
import { Suspense } from 'react'
import HeaderSearch from './header-search'
import HeaderActions from './header-actions'
import { NOTIFICATIONS_ENABLED, SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { getViewer } from './viewer'
import { Wordmark } from './wordmark'

export { Wordmark }

interface Props {
  /** Empty string ⇒ signed-out visitor. */
  username: string
  /** Optional display name (Settings → Profile) for the avatar initials + popout. */
  displayName?: string
  /** Pre-fill the search input (e.g. when staying on browse after a search). */
  searchValue?: string
}

export default async function SiteHeader({ username, displayName, searchValue = '' }: Props) {
  // Avatar initials come from the display name everywhere (reference "JD"); pages
  // that didn't load it get it here, memoised per request.
  const resolvedDisplayName = displayName !== undefined ? displayName : username ? (await getViewer()).displayName ?? undefined : undefined
  return (
    <header className="header">
      <Wordmark testId="site-wordmark" />
      {/* useSearchParams inside → needs a Suspense boundary for static shells. The fallback
          keeps the desktop layout; ≤720px it stays hidden so no page shows a stray row. */}
      <Suspense fallback={<div className="search" data-mobile="hide" aria-hidden="true" />}>
        <HeaderSearch defaultValue={searchValue} />
      </Suspense>
      <HeaderActions username={username} displayName={resolvedDisplayName} notificationsEnabled={NOTIFICATIONS_ENABLED} shippingLabelsEnabled={SHIPPING_LABELS_ENABLED} />
    </header>
  )
}
