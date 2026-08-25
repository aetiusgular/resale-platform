/**
 * /boost/[listingId] loading skeleton — package picker ghosts.
 */
import { Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 520, margin: '48px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Ghost style={{ height: 22, width: 192 }} />
        <Ghost style={{ height: 13, width: '60%' }} />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{ padding: '14px 16px', border: '1px solid var(--color-line)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} aria-hidden="true">
              <Ghost style={{ height: 14, width: 128 }} />
              <Ghost style={{ height: 14, width: 48 }} />
            </div>
          ))}
        </div>
        <Ghost style={{ marginTop: 16, height: 44, width: '100%' }} />
      </div>
    </div>
  )
}
