/**
 * /messages loading skeleton — inbox only (the desktop empty pane is gone; the
 * page shows the inbox until a thread route opens).
 */
import { Ghost } from '@/app/components/skeletons'

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
    <div>
      <div className="msgs msgs--inbox">
        <aside className="msgs__list" aria-hidden="true">
          <div className="msgs__head"><Ghost style={{ height: 30, width: 130 }} /></div>
          <div className="msgs__filters">
            <Ghost style={{ height: 11, width: 28, marginBottom: 10 }} />
            <Ghost style={{ height: 11, width: 44, marginBottom: 10 }} />
            <Ghost style={{ height: 11, width: 52, marginBottom: 10 }} />
          </div>
          <div className="msgs__scroll">
            {Array.from({ length: 6 }, (_, i) => <ConversationRowGhost key={i} />)}
          </div>
        </aside>
      </div>
    </div>
  )
}
