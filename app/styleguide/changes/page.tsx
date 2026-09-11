import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import { getViewerUsername } from '@/app/components/viewer'

export const metadata: Metadata = {
  title: 'Since 2nd1 browse',
  robots: { index: false, follow: false },
}

const BASELINE = 'https://resale-platform-4mhuvf581-2nd1.vercel.app/browse'

type Delta = { was: string; now: string }

const GROUPS: Array<{ id: string; label: string; note: string; items: Delta[] }> = [
  {
    id: 'catalog',
    label: 'Catalog',
    note: 'BROWSE RAIL + GRID',
    items: [
      { was: 'SORT: NEWEST cycles on click', now: 'SORT dropdown — NEWEST / PRICE ↑ / PRICE ↓' },
      { was: 'Filter marks are 6px dots on every row', now: 'Ink squares, filled on the selected row only' },
      { was: 'Rail has a right-edge divider', now: 'No rail divider' },
      { was: 'Results count is 19px (28px on mobile)', now: '13px mono count' },
      { was: 'Save sits on the image', now: '3:4 media; save lives in the caption row' },
    ],
  },
  {
    id: 'pdp',
    label: 'PDP',
    note: 'LISTING PAGE',
    items: [
      { was: 'BUY NOW · $price', now: 'BUY NOW — no dollar on the button' },
      { was: 'LC chip: dot + LC N LEGIT · verdict ↓', now: '{n} legit, underlined' },
      { was: 'City / region in the listed stamp', now: 'No PDP location' },
      { was: 'Ships in the US / + $X SHIPPING · US', now: 'Shipping $X · US only' },
    ],
  },
  {
    id: 'chrome',
    label: 'Header / footer',
    note: 'SITE CHROME',
    items: [
      { was: 'ALPHA 01 badge on the wordmark', now: 'ALPHA gone' },
      { was: 'SELL + solid SIGN IN; no MESSAGES; no theme', now: 'SELL + MESSAGES cluster · SIGN IN + theme cluster' },
      { was: 'Footer: US ONLY — OPEN ALPHA + escrow line; stroke socials', now: 'Official IG / TikTok glyphs; no alpha / escrow footer line' },
    ],
  },
  {
    id: 'auth',
    label: 'Auth',
    note: 'ENTER',
    items: [
      { was: 'Hero lists escrow / alpha selling points', now: 'Quieter enter — tagline only' },
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    note: 'PROTO INBOX',
    items: [
      { was: 'No guest-reachable inbox on preview', now: 'Fixture threads at /styleguide/proto/messages' },
    ],
  },
  {
    id: 'theme',
    label: 'Theme',
    note: 'DEFAULT + CONTROL',
    items: [
      { was: 'Default follows system', now: 'Light default' },
      { was: 'No theme control in the header', now: 'LIGHT / DARK / SYS in the header' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    note: 'PREVIEW ONLY',
    items: [
      { was: 'No Dialkit', now: 'Official Dialkit panel (tuning only)' },
      { was: 'Founder /browse is the live catalog', now: 'This page is the map — /browse on 2nd1 is still the old UI' },
      { was: 'Preview /browse needs live inventory', now: 'Sample listings stay on proto' },
    ],
  },
]

function DeltaRow({ was, now }: Delta) {
  return (
    <div className="delta">
      <span className="delta__was">{was}</span>
      <span className="delta__arrow" aria-hidden>→</span>
      <span className="delta__now">{now}</span>
    </div>
  )
}

export default async function StyleguideChangesPage() {
  const username = await getViewerUsername()

  return (
    <AppShell username={username}>
      <main className="page-main">
        <div className="crumb">
          <PrefetchLink href="/styleguide">INTERNAL / STYLEGUIDE</PrefetchLink>
          {' / '}
          CHANGES
        </div>
        <div className="page-head page-head--ruled">
          <h1 className="page-title">Since 2nd1 browse.</h1>
          <span className="page-note">REVIEW MAP · NOT A PRODUCT SURFACE</span>
        </div>
        <p className="delta-lead">
          Diff vs{' '}
          <a href={BASELINE} target="_blank" rel="noreferrer">
            2nd1 /browse
          </a>
          {' '}
          (committed 334d5bb). Founder /browse still has the old UI. This page is the map.
        </p>
        <div className="row row--wrap" style={{ gap: 16, paddingTop: 8 }}>
          <PrefetchLink href="/styleguide/proto" className="link-underline">PROTO</PrefetchLink>
          <PrefetchLink href="/styleguide" className="link-underline">STYLEGUIDE</PrefetchLink>
        </div>

        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`delta-${group.id}`}>
            <div className="sec-head">
              <span className="sec-head__label" id={`delta-${group.id}`}>{group.label.toUpperCase()}</span>
              <span className="page-note">{group.note}</span>
            </div>
            <div className="mt-8">
              {group.items.map((item) => (
                <DeltaRow key={item.was} {...item} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </AppShell>
  )
}
