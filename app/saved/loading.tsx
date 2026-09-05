/**
 * /saved loading skeleton — page head + tab line + saved grid.
 */
import { SiteHeaderGhost, CardGhosts, Ghost, PageHeadGhost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div className="app-shell has-tabbar">
      <SiteHeaderGhost />
      <main className="saved-main">
        <PageHeadGhost />
        <div className="tabs-line" aria-hidden="true">
          <Ghost style={{ height: 10, width: 60, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 80, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 70, marginBottom: 10 }} />
        </div>
        <div className="saved-grid">
          <CardGhosts count={10} />
        </div>
      </main>
      <TabBarGhost />
    </div>
  )
}
