/**
 * /boost/[listingId] loading skeleton — header chrome + package-picker ghosts.
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
            <Ghost style={{ height: 11, width: 110 }} />
            <div className="option-grid">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="option-cell" style={{ cursor: 'default' }}>
                  <Ghost style={{ height: 12, width: '60%' }} />
                  <Ghost style={{ height: 8, width: '80%', marginTop: 8 }} />
                </div>
              ))}
            </div>
            <Ghost style={{ height: 11, width: 80, marginTop: 44 }} />
            <Ghost style={{ height: 42, width: '100%', marginTop: 14 }} />
            <Ghost style={{ height: 36, width: 220, marginTop: 28 }} />
          </div>
          <div className="split__side">
            <div className="panel"><Ghost style={{ height: 9, width: 80 }} /><Ghost style={{ height: 13, width: '70%', marginTop: 12 }} /></div>
            <div className="panel"><Ghost style={{ height: 9, width: 110 }} /><Ghost style={{ height: 30, width: '100%', marginTop: 12 }} /><Ghost style={{ height: 30, width: '100%', marginTop: 8 }} /></div>
          </div>
        </div>
      </main>
    </div>
  )
}
