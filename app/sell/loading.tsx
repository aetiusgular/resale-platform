/**
 * /sell loading skeleton — the page's own static header + step indicator
 * (copied verbatim, they render identically every load) + form ghosts.
 */
import { Fragment } from 'react'
import Link from 'next/link'
import { Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <Link href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>———</Link>
        <span style={{ font: '600 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>List an item</span>
        <Link href="/" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
      </header>

      {/* Step indicator */}
      <div style={{ borderBottom: '1px solid var(--color-line)', background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '48px', padding: '8px 16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { n: '01', label: 'Photos' },
            { n: '02', label: 'Details' },
            { n: '03', label: 'Condition' },
            { n: '04', label: 'Price' },
          ].map((step, i) => (
            <Fragment key={step.n}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>{step.n}</span>
                <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>{step.label}</span>
              </span>
              {i < 3 && <span style={{ color: 'var(--color-ink-soft)', fontSize: '10px' }}>→</span>}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Form ghosts */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 16px 96px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Ghost style={{ height: '11px', width: '96px' }} />
        <div className="sell-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Ghost key={i} style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
        <Ghost style={{ height: '44px', width: '100%' }} />
        <Ghost style={{ height: '44px', width: '100%' }} />
        <Ghost style={{ height: '44px', width: '60%' }} />
        <Ghost style={{ height: '96px', width: '100%' }} />
      </div>

      <TabBarGhost />
    </div>
  )
}
