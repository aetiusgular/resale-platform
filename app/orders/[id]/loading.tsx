/**
 * /orders/[id] loading skeleton — header + two-column order layout
 * (mirrors order-buyer/order-seller: timeline main + summary side).
 */
import { SiteHeaderGhost, Ghost, PageHeadGhost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div className="app-shell has-tabbar">
      <SiteHeaderGhost />
      <main className="page-main">
        <Ghost style={{ height: 9, width: 140, marginBottom: 12 }} />
        <PageHeadGhost ruled />
        <div className="split mt-24" aria-hidden="true">
          <div className="split__main">
            <Ghost style={{ height: 11, width: 130 }} />
            <div className="timeline" style={{ paddingTop: 12 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="timeline__step">
                  <span className="timeline__dot" />
                  <div className="grow">
                    <Ghost style={{ height: 10, width: 160 + (i % 2) * 40 }} />
                    <Ghost style={{ height: 8, width: 110, marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
            <Ghost style={{ height: 40, width: 300, marginTop: 32 }} />
          </div>
          <div className="split__side">
            <div className="panel">
              <Ghost style={{ height: 9, width: 90 }} />
              <div className="row" style={{ gap: 12, paddingTop: 12 }}>
                <Ghost style={{ width: 44, height: 56, flexShrink: 0 }} />
                <div className="grow">
                  <Ghost style={{ height: 11, width: '60%' }} />
                  <Ghost style={{ height: 12, width: '80%', marginTop: 8 }} />
                </div>
              </div>
              <Ghost style={{ height: 30, width: '100%', marginTop: 14 }} />
              <Ghost style={{ height: 30, width: '100%', marginTop: 8 }} />
            </div>
            <div className="panel"><Ghost style={{ height: 9, width: 60 }} /><Ghost style={{ height: 22, width: '50%', marginTop: 12 }} /></div>
          </div>
        </div>
      </main>
      <TabBarGhost />
    </div>
  )
}
