'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import type { BrowseListing, FilterCounts } from './page'
import { trackEvent } from '@/lib/analytics'
import {
  recsInit, recsShutdown, observeImpressions, mergeRecsIdentity,
  trackClick, trackSave, trackUnsave, trackSearch,
} from '@/lib/recs/telemetry'
import AvatarMenu from '@/app/components/avatar-menu'
import ListingCard from '@/app/components/listing-card'
import MobileTabBar from '@/app/components/mobile-tabbar'

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
const CATEGORIES  = ['Outerwear', 'Tops', 'Bottoms', 'Footwear', 'Accessories', 'Tailoring', 'Denim', 'Knitwear']
const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest' },
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc','label': 'Price ↓' },
  { value: 'most_saved','label': 'Most saved' },
]


// ─── Monochrome checkbox ────────────────────────────────────────────────────
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: '16px', height: '16px', flex: 'none', boxSizing: 'border-box',
      border: '1px solid var(--color-ink)', borderRadius: '2px',
      background: checked ? 'var(--color-ink)' : 'var(--color-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', lineHeight: 1, color: 'var(--color-bg)',
    }}>
      {checked ? '✓' : ''}
    </span>
  )
}

// ─── Active-filter chip ─────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      height: '28px', padding: '0 10px',
      background: 'var(--color-bg)', border: '1px solid var(--color-ink)',
      borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px',
      letterSpacing: '0.08em', color: 'var(--color-ink)', whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {label.toUpperCase()}
      <span
        onClick={onRemove}
        style={{ color: 'var(--color-ink-soft)', cursor: 'pointer', fontSize: '12px' }}
        aria-label={`Remove ${label} filter`}
      >×</span>
    </span>
  )
}

// ─── Collapsible filter section ─────────────────────────────────────────────
function FilterSection({
  title, children, defaultOpen = false
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--color-line)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '24px 0',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
          {title}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-ink-soft)' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && children}
    </div>
  )
}

// ─── Filter rail (shared by desktop sidebar + mobile drawer) ────────────────
function FilterRail({
  params, update, filterCounts, userSizes, authBadgeEnabled,
}: {
  params: URLSearchParams
  update: (key: string, val: string | null) => void
  filterCounts: FilterCounts
  userSizes: Record<string, string>
  authBadgeEnabled: boolean
}) {
  const cat     = params.get('cat') ?? ''
  const dept    = params.get('dept') ?? ''
  const cond    = params.get('cond') ?? ''
  const verified = params.get('verified') === '1'
  const authenticated = params.get('authenticated') === '1'
  const dropped  = params.get('dropped') === '1'
  const hasSizes = Object.keys(userSizes).length > 0

  const condMin = cond ? parseInt(cond, 10) : null
  const sevenPlus = condMin === 7

  return (
    <div>
      {/* My Sizes */}
      <div style={{
        border: '1px solid var(--color-line)', borderRadius: '2px',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: '500 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>My sizes</span>
          {/* Toggle */}
          <span
            onClick={() => update('my_sizes', params.get('my_sizes') === '1' ? null : '1')}
            style={{ position: 'relative', width: '36px', height: '20px', border: '1px solid var(--color-ink)', borderRadius: '2px', background: 'var(--color-bg)', display: 'inline-block', cursor: 'pointer' }}
          >
            <span style={{
              position: 'absolute', top: '2px', right: '2px', width: '14px', height: '14px',
              borderRadius: '2px', background: params.get('my_sizes') === '1' ? 'var(--color-accent)' : 'var(--color-line)',
            }} />
          </span>
        </div>
        <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-ink-soft)' }}>
          hide listings that aren&apos;t your size
        </span>
        {hasSizes
          ? <PrefetchLink href="/settings" style={{ fontSize: '12px', color: 'var(--color-ink)', alignSelf: 'flex-start' }}>edit</PrefetchLink>
          : <PrefetchLink href="/settings" style={{ fontSize: '12px', color: 'var(--color-ink)', alignSelf: 'flex-start' }}>set your sizes →</PrefetchLink>
        }
      </div>

      {/* Department */}
      <FilterSection title="Department">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '16px' }}>
          {DEPARTMENTS.map(d => (
            <button
              key={d}
              onClick={() => update('dept', dept === d ? null : d)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', minHeight: '44px', boxSizing: 'border-box' }}
            >
              <Checkbox checked={dept === d} />
              <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                {d}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>
                {(filterCounts.departments[d] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category" defaultOpen={!!cat}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '16px' }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => update('cat', cat === c ? null : c)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', minHeight: '44px', boxSizing: 'border-box' }}
            >
              <Checkbox checked={cat === c} />
              <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                {c}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>
                {(filterCounts.categories[c] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Size — collapsed, text input for alpha */}
      <FilterSection title="Size">
        <div style={{ paddingBottom: '16px' }}>
          <input
            type="text"
            placeholder="e.g. M, 32, EU 43"
            defaultValue={params.get('size') ?? ''}
            onBlur={e => update('size', e.target.value.trim() || null)}
            style={{
              width: '100%', height: '44px', boxSizing: 'border-box',
              border: '1px solid var(--color-line)', borderRadius: '2px',
              padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '13px',
              color: 'var(--color-ink)', background: 'var(--color-bg)',
            }}
          />
        </div>
      </FilterSection>

      {/* Designer / Brand */}
      <FilterSection title="Designer">
        <div style={{ paddingBottom: '16px' }}>
          <input
            type="text"
            placeholder="brand name"
            defaultValue={params.get('brand') ?? ''}
            onBlur={e => update('brand', e.target.value.trim() || null)}
            style={{
              width: '100%', height: '44px', boxSizing: 'border-box',
              border: '1px solid var(--color-line)', borderRadius: '2px',
              padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '13px',
              color: 'var(--color-ink)', background: 'var(--color-bg)',
            }}
          />
        </div>
      </FilterSection>

      {/* Price */}
      <FilterSection title="Price">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '16px' }}>
          <span style={{ position: 'relative', flex: 1, height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Min</span>
            <input
              type="number"
              placeholder="$"
              defaultValue={params.get('min_price') ?? ''}
              onBlur={e => update('min_price', e.target.value || null)}
              style={{ width: '100%', border: 'none', background: 'none', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-ink)', outline: 'none' }}
            />
          </span>
          <span style={{ color: 'var(--color-ink-soft)', flex: 'none' }}>—</span>
          <span style={{ position: 'relative', flex: 1, height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Max</span>
            <input
              type="number"
              placeholder="$"
              defaultValue={params.get('max_price') ?? ''}
              onBlur={e => update('max_price', e.target.value || null)}
              style={{ width: '100%', border: 'none', background: 'none', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-ink)', outline: 'none' }}
            />
          </span>
        </div>
      </FilterSection>

      {/* Condition — compact 1–10 range */}
      <FilterSection title="Condition" defaultOpen>
        <div style={{ paddingBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '2px', marginBottom: '12px' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const active = condMin !== null && n >= condMin
              return (
                <button
                  key={n}
                  onClick={() => update('cond', condMin === n ? null : String(n))}
                  style={{
                    flex: 1, height: '24px', boxSizing: 'border-box',
                    border: `1px solid ${active ? 'var(--color-ink)' : 'var(--color-line)'}`,
                    background: active ? 'var(--color-ink)' : 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: active ? 'var(--color-bg)' : 'var(--color-ink-soft)',
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => update('cond', sevenPlus ? null : '7')}
            style={{
              display: 'inline-flex', alignItems: 'center', height: '24px', padding: '0 8px',
              background: sevenPlus ? 'var(--color-ink)' : 'var(--color-bg)',
              border: `1px solid ${sevenPlus ? 'var(--color-ink)' : 'var(--color-line)'}`,
              borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px',
              letterSpacing: '0.08em', color: sevenPlus ? 'var(--color-bg)' : 'var(--color-ink)',
              cursor: 'pointer',
            }}
          >
            7+ ONLY
          </button>
        </div>
      </FilterSection>

      {/* Seller location — placeholder for alpha */}
      <FilterSection title="Seller location">
        <div style={{ paddingBottom: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          Location filter — coming soon
        </div>
      </FilterSection>

      {/* Show only */}
      <FilterSection title="Show only" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '16px' }}>
          {authBadgeEnabled && (
          <button
            onClick={() => update('authenticated', authenticated ? null : '1')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', minHeight: '44px', boxSizing: 'border-box' }}
          >
            <Checkbox checked={authenticated} />
            <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Authenticated</span>
          </button>
          )}
          <button
            onClick={() => update('verified', verified ? null : '1')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', minHeight: '44px', boxSizing: 'border-box' }}
          >
            <Checkbox checked={verified} />
            <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Verified</span>
          </button>
          <button
            onClick={() => update('dropped', dropped ? null : '1')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', width: '100%', minHeight: '44px', boxSizing: 'border-box' }}
          >
            <Checkbox checked={dropped} />
            <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Price dropped</span>
          </button>
        </div>
      </FilterSection>

      {/* Followed searches — placeholder */}
      <FilterSection title="Followed searches">
        <div style={{ paddingBottom: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          Your followed searches appear here.
        </div>
      </FilterSection>
    </div>
  )
}

// ─── Main client component ───────────────────────────────────────────────────
export default function BrowseClient({
  initialListings,
  totalCount,
  filterCounts,
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
  const [isPending, startTransition] = useTransition()

  const [extraListings, setExtraListings]   = useState<BrowseListing[]>([])
  const [extraSaved, setExtraSaved]         = useState<Set<string>>(new Set())
  const [hasMore, setHasMore]               = useState(initialHasMore)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [savedIds, setSavedIds]             = useState(() => new Set(initialSavedIds))
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [sortOpen, setSortOpen]             = useState(false)
  const [followPending, setFollowPending]   = useState(false)
  const [followedMsg, setFollowedMsg]       = useState('')

  const allListings = [...initialListings, ...extraListings]
  const nextOffset  = currentOffset + initialListings.length

  // ── recs telemetry: init once; observe impressions as the grid grows ────────
  useEffect(() => {
    if (!recsTelemetryEnabled) return
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

  const activeCount = activeFilters.length

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
    setFollowedMsg(res.ok ? 'Search followed!' : 'Error — try again')
    setTimeout(() => setFollowedMsg(''), 3000)
  }

  const isSaved = (id: string) => savedIds.has(id) || extraSaved.has(id)

  // ─── Render ───────────────────────────────────────────────────────────────
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Newest'

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      {/* Header */}
      <header style={{
        height: '64px', borderBottom: '1px solid var(--color-line)',
        display: 'flex', alignItems: 'center', gap: '32px', padding: '0 80px',
      }}
        className="browse-header-desktop"
      >
        <PrefetchLink href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', width: '160px' }}>
          ———
        </PrefetchLink>
        {/* Search input */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <form
            onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const qv = (fd.get('q') as string).trim()
              trackEvent('search_performed', { query: qv })
              const recsFilters: Record<string, string> = {}
              if (dept) recsFilters.dept = dept
              if (cat) recsFilters.cat = cat
              if (size) recsFilters.size = size
              if (brand) recsFilters.brand = brand
              trackSearch(qv, recsFilters)
              updateFilter('q', qv || null)
            }}
            style={{ width: '100%', maxWidth: '480px' }}
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="search designers, items"
              style={{
                width: '100%', height: '44px', boxSizing: 'border-box',
                border: '1px solid var(--color-line)', borderRadius: '2px',
                padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)',
                background: 'var(--color-bg)', outline: 'none',
              }}
            />
          </form>
        </div>
        <nav style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <PrefetchLink href="/sell" style={{ display: 'inline-flex', alignItems: 'center', height: '44px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}>
            Sell
          </PrefetchLink>
          <PrefetchLink href="/saved" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>Saved</PrefetchLink>
          <PrefetchLink href="/messages" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>Messages</PrefetchLink>
          <AvatarMenu username={username} initials={username.slice(0, 2).toUpperCase()} />
        </nav>
      </header>

      {/* Mobile header */}
      <header style={{ display: 'none' }} className="browse-header-mobile">
        <div style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px' }}>
          <PrefetchLink href="/" style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', flex: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>———</PrefetchLink>
          <div style={{ flex: 1 }} />
          <AvatarMenu username={username} initials={username.slice(0, 2).toUpperCase()} />
        </div>
        {/* Mobile search */}
        <div style={{ padding: '12px 16px 0' }}>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateFilter('q', (fd.get('q') as string).trim() || null) }}>
            <input
              name="q"
              defaultValue={q}
              placeholder="search designers, items"
              style={{ width: '100%', height: '44px', boxSizing: 'border-box', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
            />
          </form>
        </div>
        {/* Mobile chip rail */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px', overflowX: 'auto', msOverflowStyle: 'none' }}>
            {activeFilters.map(f => (
              <Chip key={f.key} label={f.label} onRemove={() => updateFilter(f.key, null)} />
            ))}
          </div>
        )}
        {/* Mobile sticky controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 16px 12px', borderBottom: '1px solid var(--color-line)', background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 20px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer' }}
            data-testid="mobile-filter-btn"
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <button onClick={() => setSortOpen(o => !o)} style={{ background: 'none', border: 'none', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: '44px', padding: '0 4px' }}>
            Sort: {currentSortLabel} <span style={{ color: 'var(--color-ink-soft)', fontSize: '10px' }}>▾</span>
          </button>
        </div>
      </header>

      {/* Desktop layout */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 80px' }} className="browse-desktop-inner">
        {/* Results header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '32px 0 28px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
              {totalCount.toLocaleString()} LISTING{totalCount !== 1 ? 'S' : ''}
              {activeFilters.length > 0 ? ' FOR' : ''}
            </span>
            {activeFilters.map(f => (
              <Chip key={f.key} label={f.label} onRemove={() => updateFilter(f.key, null)} />
            ))}
            {activeFilters.length > 0 && (
              <button onClick={clearAll} style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', background: 'none', border: 'none', textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '3px', cursor: 'pointer' }}>
                Clear all
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 'none' }}>
            <button
              onClick={followSearch}
              disabled={followPending}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 24px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: followPending ? 'not-allowed' : 'pointer', opacity: followPending ? 0.7 : 1, transition: 'opacity 120ms linear', position: 'relative' }}
              data-testid="follow-search-btn"
            >
              {followedMsg || 'Follow search'}
            </button>
            {/* Sort dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSortOpen(o => !o)}
                style={{ background: 'none', border: 'none', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: '44px', padding: '0 4px' }}
                data-testid="sort-dropdown-btn"
              >
                Sort: {currentSortLabel} <span style={{ color: sortOpen ? 'var(--color-ink)' : 'var(--color-ink-soft)', fontSize: '10px' }}>{sortOpen ? '▴' : '▾'}</span>
              </button>
              {sortOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '240px', background: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', boxShadow: 'var(--shadow-1)', zIndex: 20 }}>
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { updateFilter('sort', o.value); setSortOpen(false) }}
                      style={{
                        width: '100%', height: '44px', padding: '0 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none',
                        fontSize: '14px', fontWeight: sort === o.value ? 500 : 400,
                        color: 'var(--color-ink)', cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {o.label}
                      {sort === o.value && <span style={{ fontSize: '12px' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columns */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', paddingBottom: '64px', opacity: isPending ? 0.5 : 1, transition: 'opacity 200ms' }}>
          {/* Sidebar */}
          <aside style={{ width: '240px', flex: 'none' }} className="browse-sidebar">
            <FilterRail
              params={searchParams}
              update={updateFilter}
              filterCounts={filterCounts}
              userSizes={userSizes}
              authBadgeEnabled={authBadgeEnabled}
            />
          </aside>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {allListings.length === 0 ? (
              /* Empty state */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '360px' }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: '1.6rem', lineHeight: 1.35, color: 'var(--color-ink)', margin: 0 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '40px 24px' }} data-testid="listings-grid">
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

                {/* Infinite scroll sentinel — observer pre-fetches 600px early */}
                <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: '1px' }} />

                {hasMore ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '48px' }}>
                    <div style={{ minHeight: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }} data-testid="loading-more">
                      {loadingMore ? 'LOADING…' : ''}
                    </div>
                    {/* Fallback for no-JS / no IntersectionObserver */}
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 32px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-line)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.4 : 1 }}
                      data-testid="load-more-btn"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                ) : (
                  allListings.length > 0 && (
                    <div style={{ paddingTop: '64px', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--color-ink-soft)' }} data-testid="end-of-archive">
                      End of the archive.
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile grid (hidden on desktop, shown on mobile via CSS) */}
      <div style={{ padding: '16px' }} className="browse-mobile-grid">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', marginBottom: '16px' }}>
          {totalCount.toLocaleString()} LISTINGS
        </div>
        {allListings.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.4rem', color: 'var(--color-ink)', margin: 0 }}>Nothing in the archive matches.</p>
            <button onClick={followSearch} style={{ fontSize: '14px', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>follow this search</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '32px 16px' }}>
            {allListings.map((l, i) => (
              <ListingCard key={l.id} listing={l} isSaved={isSaved(l.id)} onSaveToggle={handleSaveToggle} position={i} onProductClick={(id) => trackClick(id, 'feed')} />
            ))}
          </div>
        )}
        <div ref={sentinelRefMobile} data-testid="scroll-sentinel-mobile" style={{ height: '1px' }} />
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 24px' }}>
            <button onClick={loadMore} disabled={loadingMore} style={{ height: '44px', padding: '0 32px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-line)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: loadingMore ? 'not-allowed' : 'pointer' }}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'var(--color-bg)', overflow: 'auto', paddingBottom: '96px' }} data-testid="mobile-filter-drawer">
            <div style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1 }}>
              <span style={{ font: '600 20px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Filters</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--color-ink-soft)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <FilterRail
                params={searchParams}
                update={(k, v) => { updateFilter(k, v); setDrawerOpen(false) }}
                filterCounts={filterCounts}
                userSizes={userSizes}
                authBadgeEnabled={authBadgeEnabled}
              />
            </div>
          </div>
          {/* Sticky Show N listings button */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', borderTop: '1px solid var(--color-line)', background: 'var(--color-bg)', zIndex: 51 }}>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer' }}
              data-testid="drawer-show-btn"
            >
              Show {totalCount.toLocaleString()} listings
            </button>
          </div>
        </div>
      )}

      {/* Responsive CSS */}
      <MobileTabBar username={username} />
      <style>{`
        @media (max-width: 767px) {
          .browse-header-desktop { display: none !important; }
          .browse-header-mobile  { display: block !important; }
          .browse-desktop-inner  { display: none !important; }
          .browse-mobile-grid    { display: block !important; }
          .browse-sidebar        { display: none; }
        }
        @media (min-width: 768px) {
          .browse-header-mobile { display: none !important; }
          .browse-mobile-grid   { display: none !important; }
        }
      `}</style>
    </div>
  )
}
