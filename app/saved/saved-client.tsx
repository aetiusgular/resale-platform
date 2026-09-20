'use client'

/**
 * Saved — items / searches / sellers (design option 1A).
 * Items: 5-col card grid with PRICE DROP flags, SOLD veils and an × to unsave.
 * Searches: rows with the chip line, "n NEW", ALERTS ON/OFF, VIEW → and remove.
 * Sellers: followed sellers ("34 LISTINGS · 4.9 RATING", "2 NEW THIS WEEK") with
 * FOLLOWING toggles (FOLLOWS_ENABLED). On mount the visit stamp is refreshed so
 * the "SINCE LAST VISIT" note starts a new window next time.
 */
import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import type { SavedListing, SavedSearchRow, FollowedSeller } from './page'
import ListingCard, { formatTimeAgo } from '@/app/components/listing-card'
import { ArrowRightIcon, XIcon } from '@/app/components/icons'
import MetaLine from '@/app/components/meta-line'

type Props = {
  listings: SavedListing[]
  searches: SavedSearchRow[]
  sellers: FollowedSeller[]
  sinceVisit: { drops: number; sold: number; hadVisit: boolean }
  followsEnabled: boolean
  alertsEnabled: boolean
  /**
   * Proto tour only (/styleguide/proto): every mutation stays in local state and
   * every link is prefixed with this base, so the fixture screen is clickable
   * without a session. Undefined on the real /saved page.
   */
  protoBase?: string
}

type SavedTab = 'items' | 'searches' | 'sellers'

function savedTimeLabel(savedAt: string): string {
  return `SAVED ${formatTimeAgo(savedAt).replace(' AGO', '')}`
}

const QUERY_LABELS: Array<[string, (v: string) => string]> = [
  ['dept', (v) => v.toUpperCase().replace(/,/g, ' / ')],
  ['cat', (v) => v.toUpperCase().replace(/,/g, ' / ')],
  // Picks are stored as `Category:Subcategory` keys — show the subcategory.
  ['subcat', (v) => v.split(',').map((k) => k.slice(k.indexOf(':') + 1)).join(' / ').toUpperCase()],
  ['size', (v) => `SIZE ${v.toUpperCase()}`],
  ['brand', (v) => v.toUpperCase().replace(/,/g, ' / ')],
  ['color', (v) => v.toUpperCase().replace(/,/g, ' / ')],
  ['min_price', (v) => `OVER $${v}`],
  ['max_price', (v) => `UNDER $${v}`],
  ['cond', (v) => `CONDITION ${v}+`],
  ['verified', () => 'VERIFIED ONLY'],
  ['authenticated', () => 'AUTHENTICATED'],
  ['dropped', () => 'PRICE DROPPED'],
  ['sold', () => 'SOLD ITEMS'],
]

/** "helmut lang" + MENSWEAR | TOPS | SIZE M | UNDER $200 (reference SavedSearch).
    `chips` comes back as parts so the row can separate them with the hairline. */
export function describeQuery(query: Record<string, string>): { title: string; chips: string[] } {
  const parts: string[] = []
  for (const [k, fmt] of QUERY_LABELS) {
    const v = query[k]
    if (v) parts.push(fmt(v))
  }
  if (!query.dept) parts.unshift('ALL DEPARTMENTS')
  const title = query.q ? query.q : [query.brand, query.cat, query.dept].filter(Boolean).join(' ').replace(/,/g, ' ').toLowerCase() || 'everything'
  return { title, chips: parts }
}

export default function SavedClient({ listings: initialListings, searches: initialSearches, sellers: initialSellers, sinceVisit, followsEnabled, alertsEnabled, protoBase }: Props) {
  const router = useRouter()
  const demo = protoBase !== undefined
  const browseHref = protoBase ?? '/browse'
  // The tour has no seller profile screen; its follow rows point back at the fixture grid.
  const sellerHref = (username: string) => (demo ? browseHref : `/sellers/${username}`)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: SavedTab = tabParam === 'searches' || tabParam === 'sellers' ? tabParam : 'items'

  const [listings, setListings] = useState(initialListings)
  const [searches, setSearches] = useState(initialSearches)
  const [sellers, setSellers] = useState(initialSellers)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  // Refresh the visit stamp once per page view (the note above was computed
  // against the previous stamp on the server).
  useEffect(() => {
    if (demo) return
    fetch('/api/saves/visit', { method: 'POST', keepalive: true }).catch(() => {})
  }, [demo])

  const visible = listings.filter((l) => !removingIds.has(l.id))

  const setTab = (t: SavedTab) => {
    const p = new URLSearchParams(searchParams.toString())
    if (t === 'items') p.delete('tab')
    else p.set('tab', t)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const handleUnsave = useCallback(async (listingId: string) => {
    if (demo) { setListings((prev) => prev.filter((l) => l.id !== listingId)); return }
    setRemovingIds((prev) => new Set(prev).add(listingId))
    try {
      const res = await fetch('/api/saves', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      })
      if (res.ok) setListings((prev) => prev.filter((l) => l.id !== listingId))
    } catch { /* revert below */ }
    setRemovingIds((prev) => { const s = new Set(prev); s.delete(listingId); return s })
  }, [demo])

  const removeSearch = useCallback(async (id: string) => {
    setSearches((xs) => xs.filter((x) => x.id !== id))
    if (demo) return
    const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
    if (!res.ok) router.refresh()
  }, [router, demo])

  const toggleAlerts = useCallback(async (s: SavedSearchRow) => {
    const next = !s.alerts_enabled
    setSearches((xs) => xs.map((x) => (x.id === s.id ? { ...x, alerts_enabled: next } : x)))
    if (demo) return
    const res = await fetch(`/api/saved-searches/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts_enabled: next }),
    })
    if (!res.ok) setSearches((xs) => xs.map((x) => (x.id === s.id ? { ...x, alerts_enabled: !next } : x)))
  }, [demo])

  const viewSearch = useCallback((s: SavedSearchRow) => {
    // VIEW → moves the "n NEW" cursor, then opens browse with the query restored.
    if (!demo) {
      fetch(`/api/saved-searches/${s.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }), keepalive: true,
      }).catch(() => {})
    }
    const qs = new URLSearchParams(s.query).toString()
    router.push(qs ? `${browseHref}?${qs}` : browseHref)
  }, [router, demo, browseHref])

  const toggleFollow = useCallback(async (seller: FollowedSeller, following: boolean) => {
    const flip = () => setSellers((xs) => xs.map((x) => (x.id === seller.id ? { ...x, followed_at: following ? '' : new Date().toISOString() } : x)))
    if (demo) { flip(); return }
    const res = await fetch('/api/follows', {
      method: following ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: seller.id }),
    })
    if (res.ok) flip()
  }, [demo])

  // Tab labels: "ITEMS (7)" on desktop (1A); ≤720px "ITEMS" / "SEARCHES · 3" / "SELLERS · 5"
  // (mobile-web 06) — the item count sits in the page head there.
  const tabs: [SavedTab, string, number][] = [
    ['items', 'ITEMS', visible.length],
    ['searches', 'SEARCHES', searches.length],
    ['sellers', 'SELLERS', sellers.length],
  ]

  const noteParts = [
    sinceVisit.drops > 0 ? `${sinceVisit.drops} PRICE DROP${sinceVisit.drops > 1 ? 'S' : ''}` : '',
    sinceVisit.sold > 0 ? `${sinceVisit.sold} SOLD` : '',
  ].filter(Boolean)
  const changed = noteParts.length > 0
  const note = changed
    ? <MetaLine parts={[...noteParts, 'SINCE LAST VISIT']} />
    : sinceVisit.hadVisit ? 'NO CHANGES SINCE LAST VISIT' : 'ITEMS, SEARCHES AND SELLERS YOU FOLLOW'

  // Mobile strip VIEW → the items grid, first flagged card in view.
  const viewChanges = () => {
    if (tab !== 'items') setTab('items')
    requestAnimationFrame(() => {
      const card = document.querySelector('[data-testid="saved-items-grid"] .flag')?.closest('.card')
        ?? document.querySelector('[data-testid="saved-items-grid"]')
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <main className="saved-main">
      <div className="page-head">
        <h1 className="page-title">Saved</h1>
        <span className="page-note page-note--d" data-testid="saved-note">{note}</span>
        <span className="page-note page-note--m">{visible.length} ITEM{visible.length === 1 ? '' : 'S'}</span>
      </div>
      <div className="tabs-line" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab-mono${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)} data-testid={`saved-tab-${id}`}>
            {label}<span className="tab-mono__n--d"> ({n})</span>{id !== 'items' && <span className="tab-mono__n--m"><span className="sep" aria-hidden="true" />{n}</span>}
          </button>
        ))}
        <span className="spacer" />
        {tab === 'items' && <span className="link-underline tabs-line__sort" style={{ textDecoration: 'none' }}>SORT: RECENTLY SAVED</span>}
      </div>
      {changed && (
        <div className="since-strip">
          <span><MetaLine parts={[...noteParts, 'SINCE YOUR LAST VISIT']} /></span>
          <button type="button" className="link-underline link-underline--ink" onClick={viewChanges}>VIEW</button>
        </div>
      )}

      {tab === 'items' && (
        visible.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Nothing saved yet.</div>
            <div className="empty__sub">LISTINGS YOU SAVE ARE KEPT HERE, WITH ANY PRICE CHANGES NOTED</div>
            <div className="empty__cta"><PrefetchLink href={browseHref} className="btn-ghost btn-ghost--inline">BROWSE LISTINGS<ArrowRightIcon size={12} /></PrefetchLink></div>
          </div>
        ) : (
          <div className="saved-grid" data-testid="saved-items-grid">
            {visible.map((listing, i) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSaved
                onSaveToggle={() => handleUnsave(listing.id)}
                onRemove={() => handleUnsave(listing.id)}
                timeLabel={savedTimeLabel(listing.saved_at)}
                unavailable={listing.status !== 'active'}
                position={i}
                href={demo ? `${protoBase}/${listing.id}` : undefined}
              />
            ))}
          </div>
        )
      )}

      {tab === 'searches' && (
        <div className="rows-wrap">
          {searches.length === 0 ? (
            <div className="empty">
              <div className="empty__title">No saved searches.</div>
              <div className="empty__sub">SAVE A SEARCH FROM BROWSE AND IT LANDS HERE</div>
              <div className="empty__cta"><PrefetchLink href={browseHref} className="btn-ghost btn-ghost--inline">GO TO BROWSE<ArrowRightIcon size={12} /></PrefetchLink></div>
            </div>
          ) : (
            searches.map((s) => {
              const d = describeQuery(s.query)
              return (
                <div key={s.id} className="row-line" data-testid="saved-search-row">
                  <div className="row-line__main">
                    <div className="row-line__q">“{d.title}”</div>
                    <div className="row-line__chips"><MetaLine parts={d.chips} /></div>
                  </div>
                  <span className={`tag${s.new_count ? ' tag--solid' : ''}`}>{s.new_count} NEW</span>
                  {alertsEnabled ? (
                    <button
                      type="button"
                      className="alerts-toggle"
                      aria-pressed={s.alerts_enabled}
                      onClick={() => toggleAlerts(s)}
                      title="Alerts send push + email when new listings match"
                    >
                      <span className="alerts-toggle__label">ALERTS:</span>
                      <span className={s.alerts_enabled ? 'pill-on' : 'pill-off'}>{s.alerts_enabled ? 'ON' : 'OFF'}</span>
                    </button>
                  ) : (
                    <span className="alerts-toggle">
                      <span className="alerts-toggle__label">ALERTS:</span>
                      <span className="soon-tag">SOON</span>
                    </span>
                  )}
                  <button type="button" className="link-arrow link-arrow--ink" onClick={() => viewSearch(s)}>
                    <span className="link-arrow__label">VIEW</span><ArrowRightIcon size={12} />
                  </button>
                  <button type="button" className="row-line__rm" title="Remove" aria-label={`Remove search ${d.title}`} onClick={() => removeSearch(s.id)}>
                    <XIcon size={10} />
                  </button>
                </div>
              )
            })
          )}
          {searches.length > 0 && (
            <div className="rows-note">{alertsEnabled ? 'ALERTS SEND PUSH + EMAIL WHEN NEW LISTINGS MATCH.' : 'SEARCH ALERTS ARRIVE WITH THE NOTIFICATIONS LAUNCH.'}</div>
          )}
        </div>
      )}

      {tab === 'sellers' && (
        <div className="rows-wrap">
          {sellers.length === 0 ? (
            <div className="empty">
              <div className="empty__title">No sellers followed yet.</div>
              <div className="empty__sub">{followsEnabled ? 'FOLLOW A SELLER FROM THEIR PROFILE' : 'FOLLOWING ARRIVES SOON'}</div>
            </div>
          ) : (
            sellers.map((f) => {
              const following = !!f.followed_at
              const meta = [`${f.active_listings} ${f.active_listings === 1 ? 'LISTING' : 'LISTINGS'}`, f.rating != null ? `${f.rating.toFixed(1)} RATING` : '']
              return (
                <div key={f.id} className="row-line row-line--seller" data-testid="followed-seller-row">
                  <span className="seller-init">{f.username.slice(0, 2).toUpperCase()}</span>
                  <div className="row-line__main">
                    <div className="row-line__handle">
                      <PrefetchLink href={sellerHref(f.username)}>@{f.username}</PrefetchLink>
                      {f.verified && <span className="tag">VERIFIED</span>}
                    </div>
                    <div className="row-line__chips"><MetaLine parts={meta} /></div>
                  </div>
                  {f.new_this_week > 0 && <span className="row-line__fresh">{f.new_this_week} NEW THIS WEEK</span>}
                  {followsEnabled ? (
                    <button
                      type="button"
                      className={`btn-follow${following ? ' is-on' : ''}`}
                      aria-pressed={following}
                      onClick={() => toggleFollow(f, following)}
                    >
                      {following ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                  ) : (
                    <PrefetchLink href={sellerHref(f.username)} className="btn-follow">VIEW</PrefetchLink>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </main>
  )
}
