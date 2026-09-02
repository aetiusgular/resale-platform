/**
 * Skeleton primitives for route loading.tsx files.
 *
 * Server-safe (no client JS): static ghosts plus REAL chrome where it costs
 * nothing — wordmark/nav links and the search form work while the route loads
 * (the search form is a plain GET to /browse, no JS needed). No data-testids
 * here: e2e selectors must only ever match the real components.
 *
 * Ghost blocks use `.skeleton` (defined in globals.css).
 */
import Link from 'next/link'

export function Ghost({ style }: { style?: React.CSSProperties }) {
  return <div className="skeleton" style={style} aria-hidden="true" />
}

/** 32px avatar circle stand-in (initials unknown while loading). */
function AvatarGhost() {
  return (
    <span style={{
      width: '32px', height: '32px', borderRadius: '50%',
      border: '1px solid var(--color-line)', background: 'var(--color-bg)',
      display: 'flex', flexShrink: 0,
    }} aria-hidden="true" />
  )
}

const navLinkStyle: React.CSSProperties = {
  font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-ink-soft)',
  textDecoration: 'none',
}

/**
 * SiteHeader stand-in — same 56px chrome, real links, real search form,
 * ghost avatar. Mirrors app/components/site-header.tsx.
 */
export function SiteHeaderGhost() {
  return (
    <header className="page-inset" style={{
      height: '56px', borderBottom: '1px solid var(--color-line)',
      display: 'flex', alignItems: 'center', gap: '16px',
      background: 'var(--color-bg)',
    }}>
      <Link href="/" style={{
        font: '500 15px var(--font-ui)', letterSpacing: 0,
        color: 'var(--color-ink)', textDecoration: 'none',
        flex: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center',
      }}>
        archive
      </Link>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <form action="/browse" method="get" style={{ width: '100%', maxWidth: '480px' }}>
          <input
            name="q"
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
      <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link href="/sell" className="desktop-only" style={{
          font: '400 14px var(--font-ui)', color: 'var(--color-ink-soft)',
          textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--color-line)',
          minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 2px',
        }}>
          Sell
        </Link>
        <Link href="/enter" style={{
          font: '400 14px var(--font-ui)', color: 'var(--color-ink)',
          textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--color-line)',
          minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 2px',
        }}>
          Sign in
        </Link>
        <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AvatarGhost />
        </div>
      </nav>
    </header>
  )
}

/**
 * Browse header stand-in — mirrors the inline desktop (64px) + mobile headers
 * in app/browse/browse-client.tsx, including the mobile sticky controls row.
 */
export function BrowseHeaderGhost() {
  return (
    <>
      <header
        className="browse-header-desktop"
        style={{
          height: '64px', borderBottom: '1px solid var(--color-line)',
          display: 'flex', alignItems: 'center', gap: '32px', padding: '0 80px',
        }}
      >
        <Link href="/" style={{ font: '500 15px var(--font-ui)', letterSpacing: 0, color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', width: '160px' }}>
          archive
        </Link>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <form action="/browse" method="get" style={{ width: '100%', maxWidth: '480px' }}>
            <input
              name="q"
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
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/sell" style={{ display: 'inline-flex', alignItems: 'center', height: '44px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}>
            Sell
          </Link>
          <Link href="/saved" style={navLinkStyle}>Saved</Link>
          <Link href="/messages" style={navLinkStyle}>Messages</Link>
          <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AvatarGhost />
          </div>
        </nav>
      </header>

      <header className="browse-header-mobile" style={{ display: 'none' }}>
        <div style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px' }}>
          <Link href="/" style={{ font: '500 15px var(--font-ui)', letterSpacing: 0, color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>archive</Link>
          <div style={{ flex: 1 }} />
          <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AvatarGhost />
          </div>
        </div>
        <div style={{ padding: '12px 16px 0' }}>
          <form action="/browse" method="get">
            <input
              name="q"
              placeholder="search designers, items"
              style={{ width: '100%', height: '44px', boxSizing: 'border-box', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
            />
          </form>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 16px 12px', borderBottom: '1px solid var(--color-line)', background: 'var(--color-bg)' }}>
          <Ghost style={{ height: '44px', width: '104px' }} />
          <Ghost style={{ height: '16px', width: '96px' }} />
        </div>
      </header>
    </>
  )
}

/**
 * One listing-card ghost — line heights mirror app/components/listing-card.tsx
 * so the grid doesn't shift when real cards replace it.
 */
export function CardGhost() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }} aria-hidden="true">
      <div className="skeleton listing-card-image" style={{ aspectRatio: '3/4' }} />
      <div className="listing-card-caption">
        <Ghost style={{ height: 'var(--card-slot-brand)', width: '52%' }} />
        <Ghost style={{ marginTop: 2, height: 'var(--card-slot-title)', width: '88%' }} />
        <Ghost style={{ marginTop: 2, height: 'var(--card-slot-price)', width: '40%' }} />
        <Ghost style={{ marginTop: 2, height: 'var(--card-slot-facts)', width: '56%' }} />
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

/**
 * Mobile tab bar stand-in — same fixed 56px bar, ghost tabs. Not interactive
 * (the PROFILE href needs the username, which isn't known while loading).
 */
export function TabBarGhost() {
  return (
    <nav
      className="mobile-only"
      aria-hidden="true"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '56px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--color-bg)', borderTop: '1px solid var(--color-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 100,
      }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, height: '56px' }}>
          <Ghost style={{ width: '20px', height: '20px' }} />
          <Ghost style={{ width: '40px', height: '8px' }} />
        </div>
      ))}
    </nav>
  )
}

/** Order/inbox row ghost — thumbnail + two lines, right-aligned column. */
export function RowGhost() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
      border: '1px solid var(--color-line)', borderRadius: 2,
    }} aria-hidden="true">
      <Ghost style={{ width: 56, height: 56, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Ghost style={{ height: 13, width: '60%' }} />
        <Ghost style={{ height: 11, width: '40%' }} />
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <Ghost style={{ height: 11, width: 64 }} />
        <Ghost style={{ height: 13, width: 48 }} />
      </div>
    </div>
  )
}
