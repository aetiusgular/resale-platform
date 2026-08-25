/**
 * /messages loading skeleton — inbox list + desktop empty pane.
 */
import { SiteHeaderGhost, Ghost, TabBarGhost } from '@/app/components/skeletons'

function ConversationRowGhost() {
  return (
    <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', gap: '8px' }} aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Ghost style={{ height: '13px', width: '96px' }} />
        <Ghost style={{ height: '12px', width: '32px', marginLeft: 'auto' }} />
      </div>
      <Ghost style={{ height: '13px', width: '70%' }} />
    </div>
  )
}

export default function Loading() {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      <SiteHeaderGhost />

      <div className="messages-layout" style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '360px 1fr', alignItems: 'stretch', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ borderRight: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--color-line)' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>Messages</h1>
          </div>
          <div style={{ flex: 1 }}>
            {Array.from({ length: 6 }, (_, i) => <ConversationRowGhost key={i} />)}
          </div>
        </div>

        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ghost style={{ height: '16px', width: '192px' }} />
        </div>
      </div>

      <TabBarGhost />
    </div>
  )
}
