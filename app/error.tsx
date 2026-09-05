'use client'

/**
 * Route error boundary — rendered inside the root layout (fonts, tokens and
 * theme still apply), so it only needs the page body. Sentry (when configured)
 * captures the error through the Next instrumentation; this is the affordance.
 */
import { useEffect } from 'react'
import Link from 'next/link'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="page-main page-main--narrow">
      <div className="empty" style={{ padding: '96px 0 120px' }}>
        <div className="page-note" style={{ paddingBottom: 18 }}>SOMETHING BROKE{error.digest ? ` · REF ${error.digest}` : ''}</div>
        <div className="empty__title">This page didn&rsquo;t load.</div>
        <div className="empty__sub">NOTHING WAS CHARGED OR CHANGED — TRY AGAIN, OR HEAD BACK TO BROWSE</div>
        <div className="empty__cta row" style={{ justifyContent: 'center', gap: 10 }}>
          <button type="button" className="btn-primary btn-primary--inline" onClick={reset}>TRY AGAIN</button>
          <Link href="/browse" className="btn-ghost btn-ghost--inline">BROWSE →</Link>
        </div>
      </div>
    </main>
  )
}
