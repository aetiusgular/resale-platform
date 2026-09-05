/**
 * /messages/[id] loading skeleton — inbox list (desktop) + thread pane with the
 * bar / scroll / composer structure of thread-client.tsx.
 */
import Link from 'next/link'
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

export default function Loading() {
  return (
    <div className="app-shell has-tabbar">
      <SiteHeaderGhost />
      <div className="msgs msgs--thread">
        <aside className="msgs__list desktop-only" aria-hidden="true">
          <div className="msgs__head"><Ghost style={{ height: 22, width: 110 }} /></div>
          <div className="msgs__scroll">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="conv" style={{ cursor: 'default' }}>
                <Ghost style={{ width: 40, height: 40, flexShrink: 0 }} />
                <div className="grow">
                  <Ghost style={{ height: 11, width: 96 }} />
                  <Ghost style={{ height: 11, width: '70%', marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="thread">
          <div className="thread__bar">
            <Link href="/messages" className="thread__back" aria-label="Back to inbox">←</Link>
            <Ghost style={{ width: 28, height: 28, flexShrink: 0 }} />
            <Ghost style={{ height: 12, width: 110 }} />
            <span className="spacer" />
            <Ghost style={{ height: 8, width: 120 }} />
          </div>
          <div className="thread__scroll" aria-hidden="true" style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Ghost style={{ height: 36, width: '45%' }} />
            <Ghost style={{ height: 36, width: '38%', alignSelf: 'flex-end' }} />
            <Ghost style={{ height: 36, width: '52%' }} />
            <Ghost style={{ height: 88, width: '60%', alignSelf: 'flex-end' }} />
          </div>
          <div className="thread__composer" aria-hidden="true">
            <Ghost style={{ height: 40, width: '100%' }} />
          </div>
        </div>
      </div>
      <TabBarGhost />
    </div>
  )
}
