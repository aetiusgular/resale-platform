/**
 * /checkout/[listingId] loading skeleton — header + two-column address/card
 * form with the order panel on the side. Pure UI: no money logic here.
 */
import { Ghost, PageHeadGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div>
      <main className="page-main">
        <Ghost style={{ height: 9, width: 120, marginBottom: 12 }} />
        <PageHeadGhost ruled />
        <div className="split mt-24" aria-hidden="true">
          <div className="split__main">
            <Ghost style={{ height: 11, width: 170 }} />
            <Ghost style={{ height: 40, width: '100%', marginTop: 14 }} />
            <div className="field-grid field-grid--2-1">
              <Ghost style={{ height: 40 }} />
              <Ghost style={{ height: 40 }} />
            </div>
            <div className="field-grid field-grid--2-1-1">
              <Ghost style={{ height: 40 }} />
              <Ghost style={{ height: 40 }} />
              <Ghost style={{ height: 40 }} />
            </div>
            <Ghost style={{ height: 11, width: 90, marginTop: 44 }} />
            <Ghost style={{ height: 42, width: '100%', marginTop: 14 }} />
            <div className="field-grid">
              <Ghost style={{ height: 42 }} />
              <Ghost style={{ height: 42 }} />
            </div>
            <Ghost style={{ height: 38, width: 280, marginTop: 28 }} />
          </div>
          <div className="split__side">
            <div className="panel">
              <Ghost style={{ height: 9, width: 80 }} />
              <div className="row" style={{ gap: 12, paddingTop: 12 }}>
                <Ghost style={{ width: 44, height: 56, flexShrink: 0 }} />
                <div className="grow">
                  <Ghost style={{ height: 11, width: '55%' }} />
                  <Ghost style={{ height: 12, width: '85%', marginTop: 8 }} />
                </div>
              </div>
              <Ghost style={{ height: 30, width: '100%', marginTop: 14 }} />
              <Ghost style={{ height: 30, width: '100%', marginTop: 8 }} />
              <Ghost style={{ height: 34, width: '100%', marginTop: 8 }} />
            </div>
            <div className="panel"><Ghost style={{ height: 9, width: 60 }} /><Ghost style={{ height: 30, width: '100%', marginTop: 12 }} /><Ghost style={{ height: 30, width: '100%', marginTop: 8 }} /></div>
          </div>
        </div>
      </main>
    </div>
  )
}
