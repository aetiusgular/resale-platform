import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import { getViewerUsername } from '@/app/components/viewer'
import { BRAND_SUPPORT_EMAIL, BRAND_WORDMARK } from '@/app/components/brand'
import PrefetchLink from '@/app/components/prefetch-link'
import { ENTRY_POINTS } from '@/app/components/auth-frame'

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } }

/** /about — the pitch in four facts (design "Footer pages" board). */
export default async function AboutPage() {
  const username = await getViewerUsername()
  // Typed through string so the empty-until-launch constant doesn't narrow to `never`.
  const supportEmail: string = BRAND_SUPPORT_EMAIL
  return (
    <AppShell username={username} footerActive="/about">
      <main className="info-main">
        <div className="info-kicker">ABOUT</div>
        <h1 className="info-title">The peer-to-peer market for archive fashion.</h1>
        <p className="info-p">{BRAND_WORDMARK} is a marketplace for the clothes that outlast trends — mainline runway, dead-stock and hard-worn grails. Every sale is held in escrow until the buyer confirms delivery, and every listing carries tag macros the community can check.</p>
        <p className="info-p">We started in 2025 because the pieces we cared about deserved better than screenshot DMs and payment links. No algorithmic feed, no fast fashion — a catalog, a condition score, and people who know what they&rsquo;re looking at.</p>
        <div className="mt-32">
          {ENTRY_POINTS.map(([n, t]) => (
            <div key={n} className="fact-row"><span className="fact-row__n">{n}</span><span className="fact-row__t">{t}</span></div>
          ))}
          <div className="fact-row"><span className="fact-row__n">04</span><span className="fact-row__t">COMMUNITY LEGIT CHECK ON EVERY LISTING</span></div>
        </div>
        <div className="info-contact">
          PRESS &amp; PARTNERSHIPS —{' '}
          {supportEmail
            ? <a className="link-underline link-underline--ink" href={`mailto:${supportEmail}`}>{supportEmail.toUpperCase()}</a>
            : <PrefetchLink className="link-underline link-underline--ink" href="/help">THROUGH THE HELP PAGE</PrefetchLink>}
        </div>
      </main>
    </AppShell>
  )
}
