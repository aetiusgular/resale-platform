/**
 * /saved loading skeleton — heading + saved grid.
 */
import { SiteHeaderGhost, CardGhosts, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div className="content-pad" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
        <h1 style={{ font: '400 28px var(--font-serif)', letterSpacing: 0, color: 'var(--color-ink)', margin: 0, padding: '48px 0 24px' }}>Saved</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '20px 0 32px' }}>
          <Ghost style={{ height: '13px', width: '96px' }} />
          <Ghost style={{ height: '13px', width: '128px' }} />
        </div>
        <div className="skeleton-grid-4" style={{ paddingBottom: '96px' }}>
          <CardGhosts count={8} />
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
