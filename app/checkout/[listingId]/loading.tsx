/**
 * /checkout/[listingId] loading skeleton — minimal checkout chrome + two-column
 * order/payment ghosts. Pure UI: no money logic here.
 */
import { Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{
        height: 64, borderBottom: '1px solid var(--color-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px',
      }}>
        <span style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
        <span style={{ font: '600 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Checkout</span>
        <Ghost style={{ height: 11, width: 96 }} />
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 96px', display: 'grid', gridTemplateColumns: 'min(400px, 100%) 1fr', gap: 64, alignItems: 'start' }}>
        {/* Order summary ghost */}
        <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
            Order
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 16 }}>
            <Ghost style={{ width: 72, height: 96, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Ghost style={{ height: 13, width: '85%' }} />
              <Ghost style={{ height: 12, width: '50%' }} />
              <Ghost style={{ height: 13, width: '35%' }} />
            </div>
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Ghost style={{ height: 13, width: '100%' }} />
            <Ghost style={{ height: 13, width: '100%' }} />
            <Ghost style={{ height: 16, width: '60%' }} />
          </div>
        </div>

        {/* Payment form ghost */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Ghost style={{ height: 11, width: 96 }} />
          <Ghost style={{ height: 44, width: '100%' }} />
          <Ghost style={{ height: 44, width: '100%' }} />
          <Ghost style={{ height: 44, width: '100%' }} />
          <Ghost style={{ marginTop: 16, height: 44, width: '100%' }} />
        </div>
      </div>
    </div>
  )
}
