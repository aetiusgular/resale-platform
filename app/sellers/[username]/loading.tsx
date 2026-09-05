/**
 * /sellers/[username] loading skeleton — seller head + tabs + listings grid.
 */
import { SiteHeaderGhost, CardGhosts, Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div className="app-shell">
      <SiteHeaderGhost />
      <main className="saved-main">
        <div className="seller-head" aria-hidden="true">
          <Ghost style={{ width: 64, height: 64 }} />
          <div className="grow">
            <Ghost style={{ height: 22, width: 200 }} />
            <Ghost style={{ height: 9, width: 260, marginTop: 12 }} />
            <Ghost style={{ height: 11, width: 320, marginTop: 10 }} />
          </div>
          <Ghost style={{ height: 32, width: 96 }} />
          <Ghost style={{ height: 32, width: 84 }} />
        </div>
        <div className="tabs-line tabs-line--tight" aria-hidden="true">
          <Ghost style={{ height: 10, width: 70, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 60, marginBottom: 10 }} />
        </div>
        <div className="saved-grid">
          <CardGhosts count={10} />
        </div>
      </main>
    </div>
  )
}
