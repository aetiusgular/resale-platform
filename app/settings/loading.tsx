/**
 * /settings loading skeleton — header + settings form ghosts.
 */
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 16px 96px' }}>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Ghost style={{ height: 28, width: 160 }} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ border: '1px solid var(--color-line)', borderRadius: 2, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden="true">
              <Ghost style={{ height: 11, width: 112 }} />
              <Ghost style={{ height: 14, width: '70%' }} />
              <Ghost style={{ height: 14, width: '45%' }} />
            </div>
          ))}
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
