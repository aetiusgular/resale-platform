/**
 * /messages loading skeleton — inbox list + desktop empty pane.
 */
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

function ConversationRowGhost() {
  return (
    <div className="conv" aria-hidden="true" style={{ cursor: 'default' }}>
      <Ghost style={{ width: 40, height: 40, flexShrink: 0 }} />
      <div className="grow">
        <div className="row row--between">
          <Ghost style={{ height: 11, width: 96 }} />
          <Ghost style={{ height: 8, width: 32 }} />
        </div>
        <Ghost style={{ height: 11, width: '70%', marginTop: 8 }} />
        <Ghost style={{ height: 8, width: '45%', marginTop: 7 }} />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="app-shell has-tabbar">
      <SiteHeaderGhost />
      <div className="msgs">
        <aside className="msgs__list" aria-hidden="true">
          <div className="msgs__head"><Ghost style={{ height: 22, width: 110 }} /></div>
          <div className="msgs__filters">
            <Ghost style={{ height: 9, width: 28, marginBottom: 9 }} />
            <Ghost style={{ height: 9, width: 44, marginBottom: 9 }} />
            <Ghost style={{ height: 9, width: 52, marginBottom: 9 }} />
          </div>
          <div className="msgs__scroll">
            {Array.from({ length: 6 }, (_, i) => <ConversationRowGhost key={i} />)}
          </div>
        </aside>
        <div className="thread desktop-only">
          <div className="empty" style={{ margin: 'auto' }} aria-hidden="true">
            <Ghost style={{ height: 14, width: 160, margin: '0 auto' }} />
          </div>
        </div>
      </div>
      <TabBarGhost />
    </div>
  )
}
