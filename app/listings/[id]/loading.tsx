/**
 * /listings/[id] loading skeleton — the hottest navigation on the site
 * (browse card → detail). Paints header + gallery/right-rail layout instantly.
 */
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div className="listing-detail-inner" style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 80px 64px' }}>
        <div className="listing-detail-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '48px', alignItems: 'start' }}>
          {/* LEFT: gallery */}
          <div>
            <div className="skeleton" style={{ aspectRatio: '3/4' }} />
            <div className="listing-thumbnails" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '16px' }}>
              {Array.from({ length: 6 }, (_, i) => (
                <Ghost key={i} style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          </div>

          {/* RIGHT: details rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Ghost style={{ height: '12px', width: '96px' }} />
            <Ghost style={{ height: '28px', width: '80%' }} />
            <Ghost style={{ height: '16px', width: '40%' }} />
            <Ghost style={{ height: '22px', width: '96px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <Ghost style={{ height: '44px', width: '100%' }} />
              <Ghost style={{ height: '44px', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
              <Ghost style={{ height: '13px', width: '100%' }} />
              <Ghost style={{ height: '13px', width: '92%' }} />
              <Ghost style={{ height: '13px', width: '64%' }} />
            </div>
            <div style={{ borderTop: '1px solid var(--color-line)', marginTop: '24px', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Ghost style={{ height: '12px', width: '128px' }} />
              <Ghost style={{ height: '12px', width: '96px' }} />
            </div>
          </div>
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
