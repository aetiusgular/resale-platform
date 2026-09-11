/**
 * /listings/[id] loading skeleton — the hottest navigation on the site
 * (browse card → detail). Paints header + gallery / placard layout instantly.
 */
import { Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div>
      <div className="pdp-page">
        <div className="pdp" aria-hidden="true">
          <div className="pdp__left">
            <Ghost style={{ height: 9, width: 180, marginBottom: 14 }} />
            <div className="skeleton" style={{ aspectRatio: '3 / 4', width: '100%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 10 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <Ghost key={i} style={{ aspectRatio: '3 / 4' }} />
              ))}
            </div>
          </div>
          <div className="pdp__right">
            <Ghost style={{ height: 8, width: 150 }} />
            <Ghost style={{ height: 10, width: 90, marginTop: 22 }} />
            <Ghost style={{ height: 26, width: '85%', marginTop: 10 }} />
            <Ghost style={{ height: 9, width: '55%', marginTop: 10 }} />
            <Ghost style={{ height: 22, width: 110, marginTop: 22 }} />
            <Ghost style={{ height: 8, width: 200, marginTop: 8 }} />
            <Ghost style={{ height: 40, width: '100%', marginTop: 22 }} />
            <Ghost style={{ height: 40, width: '100%', marginTop: 8 }} />
            <Ghost style={{ height: 11, width: '100%', marginTop: 26 }} />
            <Ghost style={{ height: 11, width: '92%', marginTop: 8 }} />
            <Ghost style={{ height: 11, width: '64%', marginTop: 8 }} />
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 16 }}>
              <div className="row" style={{ gap: 10 }}>
                <Ghost style={{ width: 40, height: 40, flexShrink: 0 }} />
                <div className="grow">
                  <Ghost style={{ height: 11, width: 110 }} />
                  <Ghost style={{ height: 8, width: 150, marginTop: 8 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
