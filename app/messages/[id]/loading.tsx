/**
 * /messages/[id] loading skeleton — thread view with sidebar (desktop) and
 * back-chevron header (mobile).
 */
import Link from 'next/link'
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      {/* Mobile thread header */}
      <div className="mobile-only" style={{ height: '48px', borderBottom: '1px solid var(--color-line)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/messages" style={{ fontSize: '20px', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', lineHeight: 1, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
          ‹
        </Link>
        <Ghost style={{ height: '14px', width: '96px' }} />
      </div>

      <div className="messages-layout" style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '360px 1fr', alignItems: 'stretch', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar — desktop only */}
        <div className="messages-sidebar desktop-only" style={{ borderRight: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--color-line)' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>Messages</h1>
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '8px' }} aria-hidden="true">
              <Ghost style={{ height: '13px', width: '96px' }} />
              <Ghost style={{ height: '13px', width: '70%' }} />
            </div>
          ))}
        </div>

        {/* Thread pane */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Listing context bar */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Ghost style={{ width: '40px', height: '52px', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Ghost style={{ height: '13px', width: '160px' }} />
              <Ghost style={{ height: '12px', width: '64px' }} />
            </div>
          </div>
          {/* Bubbles */}
          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Ghost style={{ height: '36px', width: '45%' }} />
            <Ghost style={{ height: '36px', width: '38%', alignSelf: 'flex-end' }} />
            <Ghost style={{ height: '36px', width: '52%' }} />
          </div>
          {/* Composer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-line)' }}>
            <Ghost style={{ height: '44px', width: '100%' }} />
          </div>
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
