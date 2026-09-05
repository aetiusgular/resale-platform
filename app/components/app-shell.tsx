/**
 * AppShell — header + page + footer, the frame every consumer page renders
 * inside. Server component; pages pass the username they already loaded.
 * `footer={false}` for full-height panes (messages) — desktop only: mobile web ends
 * every page with the footer in the scroll (handoff 17), so it still renders there.
 *
 * Mobile WEB chrome (handoff "Mobile Web", Sept 2026): the same 6A header (wordmark,
 * SELL / SAVED / MESSAGES icons + account chip; the search row only on browse and
 * saved), page-owned docked bars (browse FILTERS | SORT, listing BUY | OFFER, sell
 * + NEW LISTING …) and bottom sheets / takeovers for overlays. No bottom tab bar —
 * that is native-app chrome and never ships in the web build.
 */
import SiteHeader from './site-header'
import SiteFooter from './site-footer'

interface Props {
  username: string
  displayName?: string
  children: React.ReactNode
  searchValue?: string
  footer?: boolean
  footerActive?: string
}

export default function AppShell({ username, displayName, children, searchValue, footer = true, footerActive }: Props) {
  return (
    <div className="app-shell">
      <SiteHeader username={username} displayName={displayName} searchValue={searchValue} />
      {children}
      <SiteFooter active={footerActive} mobileOnly={!footer} />
    </div>
  )
}
