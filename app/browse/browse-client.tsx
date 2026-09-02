'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import type { BrowseListing, FilterCounts } from './page'
import { trackEvent } from '@/lib/analytics'
import {
  recsInit, recsShutdown, observeImpressions, mergeRecsIdentity,
  trackClick, trackSave, trackUnsave,
} from '@/lib/recs/telemetry'
import ListingCard from '@/app/components/listing-card'
import MobileTabBar from '@/app/components/mobile-tabbar'
import Icon from '@/app/components/icon'
import { useAuthModal } from '@/app/components/auth-modal-provider'

type Props = {
  initialListings: BrowseListing[]
  totalCount: number
  filterCounts: FilterCounts
  initialSavedIds: string[]
  userSizes: Record<string, string>
  hasMore: boolean
  currentOffset: number
  username: string
  authBadgeEnabled: boolean
  userId: string
  recsTelemetryEnabled: boolean
}

const DEPARTMENTS = ['menswear', 'womenswear', 'unisex']
const PRIMARY_CATEGORIES = ['Outerwear', 'Tops', 'Bottoms', 'Footwear']
const OVERFLOW_CATEGORIES = ['Accessories', 'Tailoring', 'Denim', 'Knitwear']
const CATEGORIES = [...PRIMARY_CATEGORIES, ...OVERFLOW_CATEGORIES]
const SORT_OPTIONS = [
  { value: 'newest',    label: 'newest' },
  { value: 'relevance', label: 'relevant' },
  { value: 'price_asc', label: 'price ↑' },
  { value: 'price_desc','label': 'price ↓' },
  { value: 'most_saved','label': 'saved' },
]

// ─── Active-filter chip ─────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="browse-chip">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="browse-chip-remove"
      ><Icon name="close" size={10} /></button>
    </span>
  )
}

// ─── Slim refine panel — size, brand, price, condition, trust toggles ────────
function RefinePanel({
  params, update, userSizes, authBadgeEnabled, isGuest, onAuthPrompt, totalCount, onClose,
}: {
  params: URLSearchParams
  update: (key: string, val: string | null) => void
  userSizes: Record<string, string>
  authBadgeEnabled: boolean
  isGuest: boolean
  onAuthPrompt: () => void
  totalCount: number
  onClose: () => void
}) {
  const cond    = params.get('cond') ?? ''
  const verified = params.get('verified') === '1'
  const authenticated = params.get('authenticated') === '1'
  const dropped  = params.get('dropped') === '1'
  const hasSizes = Object.keys(userSizes).length > 0
  const condMin = cond ? parseInt(cond, 10) : null
  const mySizes = params.get('my_sizes') === '1'

  return (
    <div className="refine-panel-root">
      <button type="button" aria-label="Close refine" onClick={onClose} className="refine-panel-backdrop motion-panel-backdrop" />
      <div className="refine-panel-sheet motion-panel-sheet" data-testid="refine-panel">
        <div className="refine-panel-header">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-ink)' }}>refine</span>
          <button type="button" onClick={onClose} aria-label="Close refine" style={{ background: 'none', border: 'none', color: 'var(--color-ink-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44 }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ padding: '8px 16px 96px' }}>
          {isGuest ? (
            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-ink-soft)', margin: '8px 0 0' }}>
              <button type="button" onClick={onAuthPrompt} data-testid="add-sizes-guest" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--color-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Sign in
              </button>
              {' '}to filter by your sizes.
            </p>
          ) : (
            <div className="refine-section">
              <div className="refine-section-label">my sizes</div>
              <div className="refine-toggle-row">
                <button type="button" className={`refine-toggle${mySizes ? ' is-active' : ''}`} onClick={() => update('my_sizes', mySizes ? null : '1')}>
                  {mySizes ? 'on' : 'off'}
                </button>
                <PrefetchLink href="/settings" style={{ font: '400 13px var(--font-mono)', color: 'var(--color-ink-soft)', textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>
                  {hasSizes ? 'edit sizes' : 'set sizes'}
                </PrefetchLink>
              </div>
            </div>
          )}

          <div className="refine-section">
            <div className="refine-section-label">size</div>
            <input
              type="text"
              placeholder="M, 32, EU 43…"
              className="refine-field"
              defaultValue={params.get('size') ?? ''}
              onBlur={e => update('size', e.target.value.trim() || null)}
            />
          </div>

          <div className="refine-section">
            <div className="refine-section-label">brand</div>
            <input
              type="text"
              placeholder="search brands"
              className="refine-field"
              defaultValue={params.get('brand') ?? ''}
              onBlur={e => update('brand', e.target.value.trim() || null)}
            />
          </div>

          <div className="refine-section">
            <div className="refine-section-label">price</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                placeholder="min"
                className="refine-field"
                style={{ flex: 1 }}
                defaultValue={params.get('min_price') ?? ''}
                onBlur={e => update('min_price', e.target.value || null)}
              />
              <span style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>—</span>
              <input
                type="number"
                placeholder="max"
                className="refine-field"
                style={{ flex: 1 }}
                defaultValue={params.get('max_price') ?? ''}
                onBlur={e => update('max_price', e.target.value || null)}
              />
            </div>
          </div>

          <div className="refine-section">
            <div className="refine-section-label">condition</div>
            <div className="refine-cond-grid">
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const active = condMin !== null && n >= condMin
                return (
                  <button
                    key={n}
                    type="button"
                    className={`refine-cond-btn${active ? ' is-active' : ''}`}
                    onClick={() => update('cond', condMin === n ? null : String(n))}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="refine-section">
            <div className="refine-section-label">show</div>
            <div className="refine-toggle-row">
              {authBadgeEnabled && (
                <button type="button" className={`refine-toggle${authenticated ? ' is-active' : ''}`} onClick={() => update('authenticated', authenticated ? null : '1')}>
                  authenticated
                </button>
              )}
              <button type="button" className={`refine-toggle${verified ? ' is-active' : ''}`} onClick={() => update('verified', verified ? null : '1')}>
                id verified
              </button>
              <button type="button" className={`refine-toggle${dropped ? ' is-active' : ''}`} onClick={() => update('dropped', dropped ? null : '1')}>
                price dropped
              </button>
            </div>
          </div>
        </div>
        <div className="refine-panel-footer">
          <button
            type="button"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'none', color: 'var(--color-ink)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', font: '400 14px var(--font-mono)', cursor: 'pointer' }}
            data-testid="refine-show-btn"
          >
            show {totalCount.toLocaleString()} listings
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────
export default function BrowseClient({
  initialListings,
  totalCount,
  initialSavedIds,
  userSizes,
  hasMore: initialHasMore,
  currentOffset,
  username,
  authBadgeEnabled,
  userId,
  recsTelemetryEnabled,
}: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const { openAuthModal } = useAuthModal()
  const [isPending, startTransition] = useTransition()

  // Empty username/userId ⇒ signed-out visitor. Guests browse freely; any write
  // (save, follow-search) opens the sign-in popup instead of hitting the API.
  const isGuest = !userId

  const [extraListings, setExtraListings]   = useState<BrowseListing[]>([])
  const [extraSaved, setExtraSaved]         = useState<Set<string>>(new Set())
  const [hasMore, setHasMore]               = useState(initialHasMore)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [savedIds, setSavedIds]             = useState(() => new Set(initialSavedIds))
  const [refineOpen, setRefineOpen]         = useState(false)
  const [catExpanded, setCatExpanded]       = useState(false)
  const [sortOpen, setSortOpen]             = useState(false)
  const [sortAnnounce, setSortAnnounce]     = useState('')
  const [followPending, setFollowPending]   = useState(false)
  const [followedMsg, setFollowedMsg]       = useState('')
  const sortMenuRef = useRef<HTMLDivElement | null>(null)

  const allListings = [...initialListings, ...extraListings]
  const nextOffset  = currentOffset + initialListings.length

  // ── recs telemetry: init once; observe impressions as the grid grows ────────
  useEffect(() => {
    if (!recsTelemetryEnabled || !userId) return
    recsInit(userId)
    // Identity merge: fold the anon device's taste into this account (once, fail-soft).
    mergeRecsIdentity(userId)
    return () => recsShutdown()
  }, [recsTelemetryEnabled, userId])

  const shownCount = allListings.length
  useEffect(() => {
    if (!recsTelemetryEnabled || shownCount === 0) return
    // Re-scan on growth so appended cards are observed (fires start for cards
    // currently ≥50% visible; the engine dedupes downstream).
    const disconnect = observeImpressions(document)
    return disconnect
  }, [recsTelemetryEnabled, shownCount])

  const q       = searchParams.get('q') ?? ''
  const dept    = searchParams.get('dept') ?? ''
  const cat     = searchParams.get('cat') ?? ''
  const size    = searchParams.get('size') ?? ''
  const brand   = searchParams.get('brand') ?? ''
  const minPrice = searchParams.get('min_price') ?? ''
  const maxPrice = searchParams.get('max_price') ?? ''
  const cond    = searchParams.get('cond') ?? ''
  const verified = searchParams.get('verified') === '1'
  const authenticated = searchParams.get('authenticated') === '1'
  const dropped  = searchParams.get('dropped') === '1'
  const sort    = searchParams.get('sort') ?? 'newest'

  // Build active filter chips
  const activeFilters: { label: string; key: string }[] = []
  if (q)       activeFilters.push({ label: q, key: 'q' })
  if (dept)    activeFilters.push({ label: dept, key: 'dept' })
  if (cat)     activeFilters.push({ label: cat, key: 'cat' })
  if (size)    activeFilters.push({ label: `Size: ${size}`, key: 'size' })
  if (brand)   activeFilters.push({ label: brand, key: 'brand' })
  if (minPrice) activeFilters.push({ label: `Min $${minPrice}`, key: 'min_price' })
  if (maxPrice) activeFilters.push({ label: `Max $${maxPrice}`, key: 'max_price' })
  if (cond)    activeFilters.push({ label: `Condition ${cond}+`, key: 'cond' })
  if (verified) activeFilters.push({ label: 'Verified', key: 'verified' })
  if (authenticated) activeFilters.push({ label: 'Authenticated', key: 'authenticated' })
  if (dropped)  activeFilters.push({ label: 'Price dropped', key: 'dropped' })

  const refineCount = activeFilters.filter(f =>
    !['dept', 'cat', 'q'].includes(f.key),
  ).length

  const refineFilters = activeFilters.filter(f => !['dept', 'cat', 'q'].includes(f.key))
  const hasMatchingFilters = activeFilters.some(f => f.key !== 'q')
  const objectCountLabel = `${totalCount.toLocaleString()} ${totalCount === 1 ? 'listing' : 'listings'}`

  function buildUrl(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('offset') // reset pagination on any change
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    return `${pathname}?${p.toString()}`
  }

  const updateFilter = useCallback((key: string, val: string | null) => {
    setExtraListings([])
    setHasMore(false)
    startTransition(() => {
      router.push(buildUrl({ [key]: val }))
    })
    if (key !== 'q') {
      trackEvent('filter_applied', { filter: key, value: val ?? '' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname])

  function clearAll() {
    setExtraListings([])
    setHasMore(false)
    startTransition(() => {
      router.push(pathname)
    })
  }

  // ── Save / unsave ──────────────────────────────────────────────────────────
  async function handleSaveToggle(listingId: string, currentlySaved: boolean) {
    // Guest → prompt sign-in instead of hitting the (401) API. This is the canonical
    // "try to like something" gate: the popup opens; after auth they're back here and
    // can save for real.
    if (isGuest) {
      openAuthModal(pathname)
      return
    }
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev)
      if (currentlySaved) next.delete(listingId)
      else next.add(listingId)
      return next
    })

    const method = currentlySaved ? 'DELETE' : 'POST'
    const res = await fetch('/api/saves', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })

    if (!res.ok) {
      // Rollback on failure
      setSavedIds(prev => {
        const next = new Set(prev)
        if (currentlySaved) next.add(listingId)
        else next.delete(listingId)
        return next
      })
    } else if (!currentlySaved) {
      trackEvent('listing_saved', { listing_id: listingId })
      trackSave(listingId)
    } else {
      trackUnsave(listingId)
    }
  }

  // ── Load more ──────────────────────────────────────────────────────────────
  // inFlightRef guards against the observer firing again mid-fetch (fast
  // scrolling) — state alone is too slow to gate re-entry.
  const inFlightRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return
    inFlightRef.current = true
    setLoadingMore(true)
    const p = new URLSearchParams(searchParams.toString())
    p.set('offset', String(nextOffset + extraListings.length))
    const res = await fetch(`/api/browse?${p.toString()}`)
    if (res.ok) {
      const json = await res.json() as { listings: BrowseListing[]; hasMore: boolean; savedIds: string[] }
      setExtraListings(prev => [...prev, ...json.listings])
      setHasMore(json.hasMore)
      setExtraSaved(prev => {
        const next = new Set(prev)
        json.savedIds.forEach(id => next.add(id))
        return next
      })
    }
    setLoadingMore(false)
    inFlightRef.current = false
  }, [hasMore, searchParams, nextOffset, extraListings.length])

  // ── Infinite scroll ────────────────────────────────────────────────────────
  // Sentinel sits below the grid; rootMargin pre-fetches 600px before it is
  // actually reached, so the next page is usually already there on arrival.
  // The LOAD MORE button stays as a no-JS / observer-unsupported fallback.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const sentinelRefMobile = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore) return
    if (typeof IntersectionObserver === 'undefined') return
    // Both grids exist in the DOM (one is CSS-hidden per breakpoint); a hidden
    // node never intersects, so observing both is safe and covers either layout.
    const nodes = [sentinelRef.current, sentinelRefMobile.current].filter(Boolean) as HTMLDivElement[]
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) void loadMore() },
      { rootMargin: '600px 0px' },
    )
    nodes.forEach(n => observer.observe(n))
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  // ── Follow search ──────────────────────────────────────────────────────────
  async function followSearch() {
    if (isGuest) {
      openAuthModal(pathname)
      return
    }
    setFollowPending(true)
    const query: Record<string, string> = {}
    if (q)       query.q = q
    if (dept)    query.dept = dept
    if (cat)     query.cat = cat
    if (size)    query.size = size
    if (brand)   query.brand = brand
    if (minPrice) query.min_price = minPrice
    if (maxPrice) query.max_price = maxPrice
    if (cond)    query.cond = cond
    if (verified) query.verified = '1'
    if (authenticated) query.authenticated = '1'
    if (dropped)  query.dropped = '1'
    if (sort !== 'newest') query.sort = sort

    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    setFollowPending(false)
    setFollowedMsg(res.ok ? 'Search followed.' : 'Could not follow — try again')
    setTimeout(() => setFollowedMsg(''), 3000)
  }

  const isSaved = (id: string) => savedIds.has(id) || extraSaved.has(id)

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'newest'
  const activeOverflowCat = OVERFLOW_CATEGORIES.includes(cat)
  const catRailExpanded = catExpanded || activeOverflowCat
  const visibleCategories = catRailExpanded ? CATEGORIES : PRIMARY_CATEGORIES
  const showCatToggle = !activeOverflowCat

  function selectSort(value: string) {
    const next = SORT_OPTIONS.find(o => o.value === value)
    if (next) setSortAnnounce(`sorted by ${next.label}`)
    setSortOpen(false)
    updateFilter('sort', value)
  }

  useEffect(() => {
    if (!sortOpen) return
    function onDocClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [sortOpen])

  useEffect(() => {
    if (!sortOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSortOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sortOpen])

  // ─── Render ───────────────────────────────────────────────────────────────

  const catalogBody = allListings.length === 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '360px' }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 300, fontSize: '1.6rem', lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0, textWrap: 'balance' }}>
        Nothing in the archive matches.
      </p>
      <button
        onClick={followSearch}
        disabled={followPending}
        style={{ fontSize: '14px', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
      >
        follow this search and we&apos;ll notify you
      </button>
    </div>
  ) : (
    <>
      <div className="browse-catalog-grid" data-testid="listings-grid">
        {allListings.map((l, i) => (
          <ListingCard
            key={l.id}
            listing={l}
            isSaved={isSaved(l.id)}
            onSaveToggle={handleSaveToggle}
            position={i}
            onProductClick={(id) => trackClick(id, 'feed')}
          />
        ))}
      </div>
      <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: '1px' }} />
      <div ref={sentinelRefMobile} data-testid="scroll-sentinel-mobile" style={{ height: '1px' }} />
      {hasMore ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '48px' }}>
          <div style={{ minHeight: '16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }} data-testid="loading-more">
            {loadingMore ? 'Loading…' : ''}
          </div>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 32px', background: 'var(--color-bg)', color: 'var(--color-ink-soft)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', font: '400 14px var(--font-mono)', cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.4 : 1 }}
            data-testid="load-more-btn"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : (
        <div style={{ paddingTop: '64px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontWeight: 300, fontSize: '1.1rem', color: 'var(--color-ink-soft)' }} data-testid="end-of-archive">
          End of the archive.
        </div>
      )}
    </>
  )

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      {refineFilters.length > 0 && (
        <div className="browse-chip-rail">
          {refineFilters.map(f => (
            <Chip key={f.key} label={f.label} onRemove={() => updateFilter(f.key, null)} />
          ))}
          <button
            type="button"
            onClick={clearAll}
            style={{ font: '400 13px var(--font-ui)', color: 'var(--color-ink-soft)', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', minHeight: 44, padding: '0 4px' }}
          >
            clear
          </button>
        </div>
      )}

      <div className={`motion-pending${isPending ? ' is-pending' : ''}`}>
        <div className="browse-head">
          <div className="page-inset">
            <p data-testid="browse-meta" className="browse-meta">
              {q ? (
                <>
                  <span className="browse-meta-query">&ldquo;{q}&rdquo;</span>
                  <span className="browse-meta-sep" aria-hidden> · </span>
                  <span className="browse-meta-count">{objectCountLabel}</span>
                  <span className="browse-meta-sep" aria-hidden> · </span>
                  <button
                    type="button"
                    onClick={followSearch}
                    disabled={followPending}
                    className="browse-meta-link"
                    data-testid="follow-search-btn"
                  >
                    {followedMsg || 'follow search'}
                  </button>
                </>
              ) : (
                <span className="browse-meta-count">
                  {objectCountLabel}{hasMatchingFilters ? ' matching' : ''}
                </span>
              )}
            </p>

            <div className="browse-control-band">
            <div className="browse-dept-row">
              {DEPARTMENTS.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`browse-dept-toggle${dept === d ? ' is-active' : ''}`}
                  onClick={() => updateFilter('dept', dept === d ? null : d)}
                  data-testid={`filter-dept-${d}`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="browse-cat-row">
              {visibleCategories.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`browse-cat-toggle${cat === c ? ' is-active' : ''}`}
                  onClick={() => updateFilter('cat', cat === c ? null : c)}
                  data-testid={`filter-cat-${c}`}
                >
                  {c.toLowerCase()}
                </button>
              ))}
              {showCatToggle && (
                <button
                  type="button"
                  className="browse-cat-toggle is-more"
                  onClick={() => setCatExpanded(v => !v)}
                  data-testid={catRailExpanded ? 'filter-cat-less' : 'filter-cat-more'}
                  aria-expanded={catRailExpanded}
                  aria-label={catRailExpanded ? 'Show fewer categories' : 'Show more categories'}
                >
                  <Icon name={catRailExpanded ? 'minus' : 'plus'} size={12} />
                  {catRailExpanded ? 'less' : 'more'}
                </button>
              )}
            </div>

            <div className="browse-sort-row">
              <div className="browse-sort-menu" ref={sortMenuRef}>
                <button
                  type="button"
                  className="browse-sort-trigger"
                  onClick={() => setSortOpen(v => !v)}
                  data-testid="sort-menu"
                  aria-haspopup="menu"
                  aria-expanded={sortOpen}
                  aria-label={`Sort by ${activeSortLabel}`}
                >
                  {activeSortLabel}
                  <Icon name="caretDown" size={12} />
                </button>
                {sortOpen && (
                  <ul className="browse-sort-dropdown" role="menu" data-testid="sort-menu-list">
                    {SORT_OPTIONS.map(o => (
                      <li key={o.value} role="none">
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={sort === o.value}
                          className={`browse-sort-option${sort === o.value ? ' is-active' : ''}`}
                          onClick={() => selectSort(o.value)}
                          data-testid={`sort-option-${o.value}`}
                        >
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="sr-only" aria-live="polite">{sortAnnounce}</span>
              <button
                type="button"
                onClick={() => setRefineOpen(true)}
                className={`browse-refine-btn${refineCount > 0 ? ' has-filters' : ''}`}
                data-testid="refine-btn"
              >
                refine{refineCount > 0 ? ` · ${refineCount}` : ''}
              </button>
            </div>
            </div>
          </div>
        </div>

        <div className="browse-catalog page-inset page-enter">
          {catalogBody}
        </div>
      </div>

      {refineOpen && (
        <RefinePanel
          params={searchParams}
          update={updateFilter}
          userSizes={userSizes}
          authBadgeEnabled={authBadgeEnabled}
          isGuest={isGuest}
          onAuthPrompt={() => openAuthModal(pathname)}
          totalCount={totalCount}
          onClose={() => setRefineOpen(false)}
        />
      )}

      <MobileTabBar username={username} />
    </div>
  )
}
