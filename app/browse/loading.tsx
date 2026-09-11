/**
 * /browse loading skeleton — enables partial prefetch on this dynamic route and
 * paints the browse chrome (header, filter rail, results head, card grid)
 * instantly on navigation. Mirrors browse-client.tsx's .layout / .rail / .main.
 */
import { CardGhosts, Ghost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div>
      <div className="layout">
        <aside className="rail" aria-hidden="true">
          <div className="rail__top"><span className="rail__title">FILTER</span></div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--line-row)' }}>
              <Ghost style={{ height: 9, width: 72 }} />
              <Ghost style={{ height: 11, width: 150, marginTop: 12 }} />
              <Ghost style={{ height: 11, width: 118, marginTop: 8 }} />
            </div>
          ))}
        </aside>
        <main className="main">
          <div className="results" aria-hidden="true">
            <div className="results__lead">
              <Ghost style={{ height: 30, width: 96 }} />
              <Ghost style={{ height: 11, width: 140 }} />
            </div>
            <div className="results__actions desktop-only">
              <Ghost style={{ height: 11, width: 92 }} />
              <Ghost style={{ height: 11, width: 70 }} />
              <Ghost style={{ height: 11, width: 110 }} />
            </div>
          </div>
          <div className="grid">
            <CardGhosts count={12} />
          </div>
        </main>
      </div>
    </div>
  )
}
