/**
 * /orders loading skeleton — purchases + sales sections.
 */
import { SiteHeaderGhost, Ghost, RowGhost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: '0 0 32px' }}>
          Orders
        </h1>

        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <h2 style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', margin: 0 }}>
              Purchases
            </h2>
            <Ghost style={{ height: 11, width: 16 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RowGhost />
            <RowGhost />
            <RowGhost />
          </div>
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <h2 style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', margin: 0 }}>
              Sales
            </h2>
            <Ghost style={{ height: 11, width: 16 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RowGhost />
            <RowGhost />
          </div>
        </section>
      </div>

      <TabBarGhost />
    </div>
  )
}
