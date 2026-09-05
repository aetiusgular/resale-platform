/**
 * /settings loading skeleton — header + account rail + section ghosts.
 */
import { SiteHeaderGhost, Ghost, PageHeadGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div className="app-shell">
      <SiteHeaderGhost />
      <div className="layout">
        <aside className="rail" aria-hidden="true">
          <div className="rail__top"><span className="rail__title">ACCOUNT</span><Ghost style={{ height: 9, width: 80 }} /></div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="row row--between" style={{ padding: '13px 0', borderBottom: '1px solid var(--line-row)' }}>
              <Ghost style={{ height: 10, width: 90 + (i % 3) * 20 }} />
              <Ghost style={{ height: 8, width: 30 }} />
            </div>
          ))}
        </aside>
        <main className="main main--settings">
          <div className="settings-body">
            <PageHeadGhost ruled />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} aria-hidden="true">
                <Ghost style={{ height: 11, width: 120, marginTop: 44 }} />
                <Ghost style={{ height: 40, width: '100%', marginTop: 14 }} />
                <Ghost style={{ height: 40, width: '70%', marginTop: 12 }} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
