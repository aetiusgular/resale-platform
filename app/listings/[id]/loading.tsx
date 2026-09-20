/**
 * /listings/[id] loading skeleton — the hottest navigation on the site
 * (browse card → detail). It reuses the page's own layout classes (.pdp__back,
 * .pdp-gallery, .pdp-stage, .pdp-thumbs) so the stage, the strip and the placard
 * land exactly where the real ones do at every width: nothing shifts on load.
 */
import { Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div>
      <div className="pdp-page">
        <div className="pdp" aria-hidden="true">
          <div className="pdp__left">
            <div className="pdp__back">
              <Ghost style={{ height: 11, width: 47 }} />
            </div>
            <div className="pdp-gallery">
              <div className="pdp-stage skeleton" />
              <div className="pdp-thumbs" style={{ overflow: 'hidden' }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Ghost key={i} style={{ flex: '1 1 0', height: 'var(--pdp-thumb-strip)' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="pdp__right">
            {/* order: the stacked layout (≤960px) sorts the unwrapped columns' children by
                `order`; back = 1, gallery = 2, so the placard ghosts follow them. */}
            <div style={{ order: 3 }}>
              <Ghost style={{ height: 9, width: 110 }} />
              <Ghost style={{ height: 9, width: 50, marginTop: 10 }} />
              <Ghost style={{ height: 16, width: 120, marginTop: 24 }} />
              <Ghost style={{ height: 12, width: '55%', marginTop: 10 }} />
              <Ghost style={{ height: 9, width: 70, marginTop: 12 }} />
              <Ghost style={{ height: 20, width: 80, marginTop: 18 }} />
              <Ghost style={{ height: 9, width: 140, marginTop: 10 }} />
              <div className="row" style={{ gap: 9, marginTop: 20 }}>
                <Ghost style={{ height: 52, flex: 1 }} />
                <Ghost style={{ height: 52, flex: 1 }} />
              </div>
              <Ghost style={{ height: 12, width: 120, marginTop: 20 }} />
              <Ghost style={{ height: 9, width: 90, marginTop: 40 }} />
              <Ghost style={{ height: 11, width: '92%', marginTop: 12 }} />
              <Ghost style={{ height: 11, width: '64%', marginTop: 8 }} />
              <div className="row" style={{ gap: 10, marginTop: 34 }}>
                <Ghost style={{ width: 22, height: 22, flexShrink: 0 }} />
                <div className="grow">
                  <Ghost style={{ height: 10, width: 110 }} />
                  <Ghost style={{ height: 9, width: 150, marginTop: 6 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
