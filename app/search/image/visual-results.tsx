'use client'

/**
 * Search-by-image results (design page 21): R1 matches + close, R2 not listed (closest
 * pieces), M2 the ≤720px layout. Reads the client store; the header field above mirrors
 * the same query (chip + IMAGE · CATEGORY, typed words re-run the search with the image).
 *
 * Head: thumbnail · "2 matches · 6 close in Outerwear" (or "Not listed." + "These are the
 * closest pieces · …") · category chip (the engine's zero-shot guess, or the pick) ·
 * ALL CATEGORIES · NEW SEARCH · on not-listed, GET AN ALERT WHEN IT'S LISTED (disabled
 * until visual saved search, P3b). Sections: MATCHES (engine exact + match, hash exact)
 * then CLOSE, on the browse card grid.
 *
 * recs hooks: impressions on every card (observeImpressions), click_detail with
 * source 'visual_search', save / unsave; the `search` event fires in the store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import ListingCard from '@/app/components/listing-card'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { CaretDown } from '@phosphor-icons/react/ssr'
import { trackEvent } from '@/lib/analytics'
import {
  mergeRecsIdentity, observeImpressions, recsInit, recsShutdown, trackClick, trackSave, trackUnsave,
} from '@/lib/recs/telemetry'
import { CATEGORIES } from '@/lib/taxonomy'
import { countTiers, resultsHeadline, type VisualSearchHit } from '@/lib/visual-search/shared'
import { clearVisualSearch, runVisualSearch, useVisualSearch } from '@/lib/visual-search/store'

type Props = {
  username: string
  userId: string
  authBadgeEnabled: boolean
  recsTelemetryEnabled: boolean
}

export default function VisualResults({ username, userId, authBadgeEnabled, recsTelemetryEnabled }: Props) {
  const visual = useVisualSearch()
  const pathname = usePathname()
  const { openAuthModal } = useAuthModal()
  const isGuest = !userId
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())
  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  const res = visual.status === 'ready' ? visual.response : null
  const matches = useMemo<VisualSearchHit[]>(() => (res ? [...res.exact, ...res.match] : []), [res])
  const close = useMemo<VisualSearchHit[]>(() => (res ? res.close : []), [res])

  // The viewer's saves among the results come with each response: reset the local set
  // when a new response lands (state adjusted during render, the documented pattern).
  const [seenRes, setSeenRes] = useState(res)
  if (res !== seenRes) {
    setSeenRes(res)
    setSavedIds(new Set(res?.saved_ids ?? []))
  }

  // ── recs telemetry: init once; impressions on every result set ─────────────────────
  useEffect(() => {
    if (!recsTelemetryEnabled || !userId) return
    recsInit(userId)
    mergeRecsIdentity(userId)
    return () => recsShutdown()
  }, [recsTelemetryEnabled, userId])
  const shown = matches.length + close.length
  useEffect(() => {
    if (!recsTelemetryEnabled || shown === 0) return
    return observeImpressions(document)
  }, [recsTelemetryEnabled, shown, visual.seq])

  // Category menu closes on outside click / Escape.
  useEffect(() => {
    if (!catOpen) return
    const onDown = (e: MouseEvent) => { if (!catRef.current?.contains(e.target as Node)) setCatOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCatOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [catOpen])

  // The query stays in memory when a card is opened, so Back lands on the same results;
  // only the field's × and NEW SEARCH forget it (and a reload, by design).

  const handleSaveToggle = useCallback(async (listingId: string, currentlySaved: boolean) => {
    if (isGuest) {
      const hit = [...matches, ...close].find((h) => h.listing_id === listingId)
      openAuthModal(pathname, hit ? {
        title: 'SIGN IN TO SAVE',
        cta: 'SIGN IN & SAVE →',
        listing: { brand: hit.listing.brand, title: hit.listing.title, image: hit.listing.images[0] ?? null },
      } : undefined)
      return
    }
    setSavedIds((prev) => { const next = new Set(prev); if (currentlySaved) next.delete(listingId); else next.add(listingId); return next })
    const r = await fetch('/api/saves', {
      method: currentlySaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })
    if (!r.ok) {
      setSavedIds((prev) => { const next = new Set(prev); if (currentlySaved) next.add(listingId); else next.delete(listingId); return next })
    } else if (!currentlySaved) {
      trackEvent('listing_saved', { listing_id: listingId })
      trackSave(listingId)
    } else {
      trackUnsave(listingId)
    }
  }, [isGuest, matches, close, openAuthModal, pathname])

  const pickCategory = (category: string | null) => {
    setCatOpen(false)
    // an explicit pick filters; ALL CATEGORIES drops both the pick and the engine's guess
    void runVisualSearch({ category, autoCategory: category !== null })
  }

  // ── empty state (reload, NEW SEARCH) and the staged state (image attached, not sent) ──
  if (!visual.image || visual.status === 'idle') {
    return (
      <main className="vs-main vs-main--empty" data-testid="vs-empty">
        <div className="vs-empty__title">Search by image.</div>
        <div className="vs-empty__sub">ADD A PHOTO WITH THE ICON IN THE SEARCH FIELD, PASTE ONE (⌘V OR ⌘K), OR DROP IT ANYWHERE</div>
      </main>
    )
  }
  if (visual.status === 'staged') {
    return (
      <main className="vs-main vs-main--empty" data-testid="vs-staged">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vs-thumb" src={visual.image.url} alt="Attached image" />
        <div className="vs-empty__title">Image attached.</div>
        <div className="vs-empty__sub">ADD WORDS IN THE SEARCH FIELD IF YOU WANT, THEN PRESS ENTER</div>
      </main>
    )
  }

  const counts = res ? countTiers(res) : { exact: 0, match: 0, close: 0 }
  const category = res?.category ?? visual.query.category
  const head = resultsHeadline(counts, category)
  const notListed = res ? !res.listed : false
  const gridCard = (hit: VisualSearchHit, i: number) => (
    <ListingCard
      key={hit.listing_id}
      listing={hit.listing}
      isSaved={savedIds.has(hit.listing_id)}
      onSaveToggle={handleSaveToggle}
      position={i}
      own={hit.listing.own || (!!username && hit.listing.seller?.username === username)}
      showAuthBadge={authBadgeEnabled}
      onProductClick={(id) => trackClick(id, 'visual_search')}
      imgLoading={i < 8 ? 'eager' : 'lazy'}
    />
  )

  return (
    <main className="vs-main" style={{ opacity: visual.status === 'searching' ? 0.55 : 1, transition: 'opacity 200ms' }} data-testid="vs-results">
      <div className="vs-head">
        <div className="vs-head__lead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vs-thumb" src={visual.image.url} alt="Your query image" data-testid="vs-thumb" />
          <div className="vs-head__text">
            {visual.status === 'error' ? (
              <div className="vs-line"><span className="vs-lead">Search failed.</span><span className="vs-meta">{visual.error ?? 'TRY AGAIN'}</span></div>
            ) : (
              <div className="vs-line" data-testid="vs-headline">
                <span className="vs-lead">{head.lead}</span>
                <span className="vs-meta">{head.meta}</span>
              </div>
            )}
            <div className="vs-cats" ref={catRef}>
              <button
                type="button"
                className="vs-chip"
                onClick={() => setCatOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={catOpen}
                data-testid="vs-category-chip"
              >
                {(category ?? 'ANY CATEGORY').toUpperCase()}
                <CaretDown size={8} aria-hidden="true" />
              </button>
              {category && (
                <button type="button" className="vs-all" onClick={() => pickCategory(null)} data-testid="vs-all-categories">
                  <span className="vs-all__long">ALL CATEGORIES</span><span className="vs-all__short">ALL</span>
                </button>
              )}
              {catOpen && (
                <ul className="vs-menu" role="listbox" aria-label="Category" data-testid="vs-category-menu">
                  {CATEGORIES.filter((c) => c !== 'Other').map((c) => (
                    <li key={c}>
                      <button type="button" role="option" aria-selected={c === category} className={`vs-menu__item${c === category ? ' is-on' : ''}`} onClick={() => pickCategory(c)}>
                        {c.toUpperCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {res?.engine === 'unavailable' && (
              <div className="vs-note" data-testid="vs-engine-note">ENGINE UNAVAILABLE · SAME-PHOTO MATCHES ONLY</div>
            )}
            {res && visual.query.text && !res.text && (
              <div className="vs-note" data-testid="vs-text-note">WORDS NOT APPLIED · THE ENGINE HAS NO TEXT TOWER YET</div>
            )}
          </div>
        </div>
        <div className="vs-head__actions">
          <button type="button" className="link-btn vs-new" onClick={() => clearVisualSearch()} data-testid="vs-new-search">NEW SEARCH</button>
          {notListed && (
            <div className="vs-alert">
              <button type="button" className="btn-outline btn-outline--mono vs-alert__btn" disabled title="Visual saved search is not built yet" data-testid="vs-alert-btn">
                GET AN ALERT WHEN IT&rsquo;S LISTED
              </button>
              <span className="vs-alert__note">DISABLED UNTIL VISUAL SAVED SEARCH (P3B)</span>
            </div>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <section className="vs-section" data-testid="vs-matches">
          <header className="vs-section__head"><span>MATCHES</span><span className="vs-section__count">{matches.length}</span></header>
          <div className="grid vs-grid">{matches.map(gridCard)}</div>
        </section>
      )}
      <section className="vs-section" data-testid="vs-close">
        <header className="vs-section__head"><span>CLOSE</span><span className="vs-section__count">{close.length}</span></header>
        {close.length > 0 ? (
          <div className="grid vs-grid">{close.map((h, i) => gridCard(h, matches.length + i))}</div>
        ) : (
          <div className="vs-none">NOTHING CLOSE IN THE ARCHIVE{category ? ` FOR ${category.toUpperCase()}` : ''}</div>
        )}
      </section>
    </main>
  )
}
