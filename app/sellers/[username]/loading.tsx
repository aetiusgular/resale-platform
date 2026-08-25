/**
 * /sellers/[username] loading skeleton — profile head + listings grid.
 */
import { SiteHeaderGhost, CardGhosts, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div className="seller-profile-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 80px 96px' }}>
        <Ghost style={{ height: '28px', width: '224px' }} />
        <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
          <Ghost style={{ height: '13px', width: '80px' }} />
          <Ghost style={{ height: '13px', width: '80px' }} />
          <Ghost style={{ height: '13px', width: '80px' }} />
        </div>

        <div style={{ marginTop: '48px' }}>
          <Ghost style={{ height: '11px', width: '112px' }} />
          <div className="skeleton-grid-4" style={{ marginTop: '24px' }}>
            <CardGhosts count={8} />
          </div>
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
