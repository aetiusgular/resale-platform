import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import { getViewerUsername } from '@/app/components/viewer'

export const metadata: Metadata = { title: 'Not found', robots: { index: false, follow: false } }

/** Branded 404 — also what notFound() renders for missing or non-visible listings. */
export default async function NotFound() {
  const username = await getViewerUsername()
  return (
    <AppShell username={username}>
      <main className="page-main page-main--narrow">
        <div className="empty" style={{ padding: '96px 0 120px' }}>
          <div className="page-note" style={{ paddingBottom: 18 }}>404</div>
          <div className="empty__title">Nothing at this address.</div>
          <div className="empty__sub">IT MAY HAVE SOLD, BEEN REMOVED, OR NEVER EXISTED</div>
          <div className="empty__cta row" style={{ justifyContent: 'center', gap: 10 }}>
            <PrefetchLink href="/browse" className="btn-primary btn-primary--inline" data-testid="not-found-browse">BROWSE THE ARCHIVE →</PrefetchLink>
            <PrefetchLink href="/help" className="btn-ghost btn-ghost--inline">HELP</PrefetchLink>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
