/**
 * AppShell — page + footer. The site header is mounted once by app/layout.tsx
 * (ShellSwitch) so it persists across navigations; only the page below it reloads.
 * `footer={false}` for full-height panes (messages) — desktop only: mobile web ends
 * every page with the footer in the scroll (handoff 17), so it still renders there.
 *
 * Mobile WEB chrome (handoff "Mobile Web", Sept 2026): the same 6A header (wordmark,
 * SELL / SAVED / MESSAGES icons + account chip; the search row only on browse and
 * saved), page-owned docked bars (browse FILTERS | SORT, listing BUY | OFFER, sell
 * + NEW LISTING …) and bottom sheets / takeovers for overlays. No bottom tab bar —
 * that is native-app chrome and never ships in the web build.
 */
import SiteFooter from './site-footer'

interface Props {
  username: string
  displayName?: string
  children: React.ReactNode
  searchValue?: string
  footer?: boolean
  footerActive?: string
}

// username / displayName / searchValue are accepted for compatibility with existing pages;
// the header now renders once in app/layout.tsx (ShellSwitch) and reads the viewer itself.
export default function AppShell({ children, footer = true, footerActive }: Props) {
  return (
    <>
      {children}
      <SiteFooter active={footerActive} mobileOnly={!footer} />
    </>
  )
}
