/**
 * /browse loading skeleton — enables partial prefetch on this dynamic route and
 * paints the browse chrome + card grid instantly on navigation.
 */
import { BrowseHeaderGhost, CardGhosts, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <BrowseHeaderGhost />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 80px' }} className="browse-desktop-inner">
        {/* Results header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '32px 0 28px' }}>
          <Ghost style={{ height: '14px', width: '128px' }} />
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Ghost style={{ height: '44px', width: '144px' }} />
            <Ghost style={{ height: '14px', width: '96px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', paddingBottom: '64px' }}>
          {/* Filter rail */}
          <aside className="desktop-only" style={{ width: '240px', flex: 'none', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Ghost style={{ height: '11px', width: '72px' }} />
                <Ghost style={{ height: '14px', width: '160px' }} />
                <Ghost style={{ height: '14px', width: '128px' }} />
              </div>
            ))}
          </aside>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="skeleton-grid-4">
              <CardGhosts count={12} />
            </div>
          </div>
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
