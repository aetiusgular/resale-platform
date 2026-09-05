/**
 * Skeleton primitives for route loading.tsx files.
 *
 * Server-safe (no client JS): static ghosts plus REAL chrome where it costs
 * nothing — wordmark and a plain GET search form work while the route loads.
 * No data-testids here: e2e selectors must only ever match the real components.
 *
 * Ghost blocks use `.skeleton` (defined in globals.css).
 */
import Link from 'next/link'
import { BRAND_STAGE, BRAND_WORDMARK } from './brand'
import { SearchIcon } from './icons'

export function Ghost({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return <div className={`skeleton${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />
}

/** SiteHeader stand-in — same sticky 64px chrome, real wordmark + search form, ghost actions. */
export function SiteHeaderGhost() {
  return (
    <header className="header">
      <Link className="header__brand" href="/" title="Home">
        <span className="header__logo">{BRAND_WORDMARK}</span>
        <span className="header__alpha">{BRAND_STAGE}</span>
      </Link>
      <form action="/browse" method="get" className="search" role="search">
        <SearchIcon />
        <input name="q" placeholder="Search designers, items, sellers" aria-label="Search" autoComplete="off" />
      </form>
      <div className="header__actions" aria-hidden="true">
        <Ghost style={{ width: 44, height: 12 }} />
        <Ghost style={{ width: 52, height: 12 }} />
        <Ghost style={{ width: 70, height: 12 }} />
        <span className="header__divider" />
        <Ghost style={{ width: 30, height: 30 }} />
      </div>
    </header>
  )
}

/** Alias kept for the browse loading route. */
export const BrowseHeaderGhost = SiteHeaderGhost

/** One listing-card ghost — line heights mirror app/components/listing-card.tsx. */
export function CardGhost() {
  return (
    <div className="card" aria-hidden="true" style={{ cursor: 'default' }}>
      <div className="card__media skeleton" />
      <div className="card__row1">
        <Ghost style={{ height: 11, width: '52%' }} />
        <Ghost style={{ height: 11, width: 18 }} />
      </div>
      <Ghost style={{ height: 12, width: '78%', marginTop: 6 }} />
      <div className="card__row2">
        <Ghost style={{ height: 12, width: 48 }} />
        <Ghost style={{ height: 9, width: 40 }} />
      </div>
    </div>
  )
}

/** N card ghosts to spread into any listings grid container. */
export function CardGhosts({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <CardGhost key={i} />)}
    </>
  )
}

/** Page-title stand-in (page-head with ghost title + note). */
export function PageHeadGhost({ ruled }: { ruled?: boolean }) {
  return (
    <div className={`page-head${ruled ? ' page-head--ruled' : ''}`} aria-hidden="true">
      <Ghost style={{ height: 26, width: 140 }} />
      <Ghost style={{ height: 9, width: 180 }} />
    </div>
  )
}

/** Order/inbox row ghost — thumbnail + two lines, right-aligned column. */
export function RowGhost() {
  return (
    <div className="order-row" aria-hidden="true">
      <Ghost style={{ width: 44, height: 56, flexShrink: 0 }} />
      <div className="order-row__main" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Ghost style={{ height: 11, width: '48%' }} />
        <Ghost style={{ height: 12, width: '66%' }} />
        <Ghost style={{ height: 8, width: '36%' }} />
      </div>
      <Ghost style={{ height: 13, width: 48 }} />
      <Ghost style={{ height: 14, width: 70 }} />
    </div>
  )
}
