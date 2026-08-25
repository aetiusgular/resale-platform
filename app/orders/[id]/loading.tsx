/**
 * /orders/[id] loading skeleton — minimal header + two-column order layout
 * (mirrors order-buyer/order-seller: 1fr / 360px).
 */
import Link from 'next/link'
import { Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{ height: 64, borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px' }}>
        <span style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
        <Link href="/orders" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>
          All orders
        </Link>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 96px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 64, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Ghost style={{ height: 11, width: 96 }} />
          <Ghost style={{ height: 28, width: '60%' }} />
          <Ghost style={{ height: 13, width: '40%' }} />
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Ghost style={{ height: 13, width: '100%' }} />
            <Ghost style={{ height: 13, width: '88%' }} />
            <Ghost style={{ height: 13, width: '72%' }} />
          </div>
          <Ghost style={{ marginTop: 24, height: 44, width: 240 }} />
        </div>

        <div style={{ border: '1px solid var(--color-line)', borderRadius: 2, padding: 16, display: 'flex', gap: 16 }}>
          <Ghost style={{ width: 72, height: 96, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Ghost style={{ height: 13, width: '80%' }} />
            <Ghost style={{ height: 12, width: '50%' }} />
            <Ghost style={{ height: 13, width: '35%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
