/**
 * /browse loading skeleton — enables partial prefetch on this dynamic route and
 * paints the browse chrome + card grid instantly on navigation.
 */
import { SiteHeaderGhost, CardGhosts, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div className="browse-head">
        <div className="page-inset">
          <div className="browse-meta">
            <Ghost style={{ height: '12px', width: '96px' }} />
          </div>
          <div className="browse-control-band">
            <Ghost style={{ height: '14px', width: '200px' }} />
            <Ghost style={{ height: '14px', width: '280px', marginTop: 'var(--band-pad-y)' }} />
            <Ghost style={{ height: '14px', width: '120px', marginTop: 'var(--band-pad-y)' }} />
          </div>
        </div>
      </div>
      <div className="browse-catalog page-inset">
        <div className="browse-catalog-grid">
          <CardGhosts count={12} />
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
