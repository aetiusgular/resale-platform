/**
 * /sell loading skeleton — catalog head + stats + listing grid.
 */
import { CardGhosts, Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div>
      <main className="saved-main">
        <div className="sell-head" aria-hidden="true">
          <div>
            <Ghost style={{ height: 30, width: 150 }} />
            <Ghost style={{ height: 9, width: 300, marginTop: 12 }} />
          </div>
          <Ghost style={{ height: 36, width: 140 }} />
        </div>
        <div className="tabs-line tabs-line--tight" aria-hidden="true">
          <Ghost style={{ height: 10, width: 44, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 64, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 74, marginBottom: 10 }} />
          <Ghost style={{ height: 10, width: 44, marginBottom: 10 }} />
        </div>
        <div className="grid">
          <CardGhosts count={8} />
        </div>
      </main>
    </div>
  )
}
