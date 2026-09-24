'use client'

/**
 * Browse / search — design option 16A: filter rail (left) + results header
 * (count, MY SIZES toggle, EDIT SIZES, SAVE SEARCH +, cycling boxed SORT) +
 * active filter chips + 4-col listing grid + LOAD MORE.
 *
 * Mobile web (≤720px, mobile-web handoff 01–04): the rail hides; a dock fixed at the
 * viewport bottom (FILTERS · n | SORT · label) is part of this page, not a tab bar.
 * FILTERS opens the full-screen takeover (02: "FILTER (n)" / CLEAR FILTERS / ×, the rail,
 * SHOW n RESULTS); SORT opens a bottom sheet (03); MY SIZES is a row at the top of the
 * takeover and its editor is a bottom sheet (04). The results head keeps only the count,
 * the scope and SAVE SEARCH +.
 *
 * All filter state lives in the URL (searchParams) so pages are shareable and
 * the server does the querying; this component only edits the URL, appends
 * load-more pages, and handles saves / follow-search / sizes.
 */
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState, useTransition, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { BrowseListing, FilterCounts } from './page'
import { sizesChipLabel, type UserSizes } from '@/lib/sizes'
import {
  CATEGORY_TREE, COLORS, DEPARTMENTS, categoriesWithSubcategory, categoryScopeLabel, colorByLabel, departmentScopeLabel,
  parseSubcatKey, picksByCategory, resolveCategorySelection, searchColors, subcatKey, type ColorOption,
} from '@/lib/taxonomy'
import { trackEvent } from '@/lib/analytics'
import {
  recsInit, recsShutdown, observeImpressions, mergeRecsIdentity,
  trackClick, trackSave, trackUnsave,
} from '@/lib/recs/telemetry'
import ListingCard from '@/app/components/listing-card'
import SizesModal from '@/app/components/sizes-modal'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { CheckIcon, FilterIcon, XIcon } from '@/app/components/icons'
import { CaretDown } from '@phosphor-icons/react/ssr'

type Props = {
  initialListings: BrowseListing[]
  totalCount: number
  filterCounts: FilterCounts
  initialSavedIds: string[]
  userSizes: UserSizes
  /** Server-resolved: URL my_sizes=1, or the profile switch "Hide listings that aren't my size". */
  mySizesOn: boolean
  hasMore: boolean
  currentOffset: number
  username: string
  authBadgeEnabled: boolean
  userId: string
  recsTelemetryEnabled: boolean
}

/** Cycling sort — option 16A: NEWEST → PRICE ↑ → PRICE ↓. `hint` is the mobile sheet's right column (03). */
const SORTS = [
  { value: 'newest',     label: 'NEWEST',  hint: 'DEFAULT' },
  { value: 'price_asc',  label: 'PRICE ↑', hint: 'LOW TO HIGH' },
  { value: 'price_desc', label: 'PRICE ↓', hint: 'HIGH TO LOW' },
]
const SHOW_ONLY: Array<{ id: 'authenticated' | 'verified' | 'dropped' | 'sold'; label: string }> = [
  { id: 'authenticated', label: 'Authenticated' },
  { id: 'verified',      label: 'Verified sellers' },
  { id: 'dropped',       label: 'Price dropped' },
  { id: 'sold',          label: 'Sold items' },
]
const DESIGNERS_SHOWN = 5
/** COLOR rows shown before VIEW ALL (the reference rail's eight). */
const COLORS_SHOWN = 8

const fmt = (n: number) => n.toLocaleString('en-US')
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
/** "MAISON MARGIELA" → "Maison Margiela" for the rail (cards keep the upper-case brand). */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(-])([a-zà-ÿ])/g, (m) => m.toUpperCase())
const csv = (v: string | null) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
const without = (list: string[], v: string) => list.filter((x) => x !== v)

/** DEPARTMENT + CATEGORY rail state straight from the URL (multi-select, see lib/taxonomy). */
function readRailSelection(params: URLSearchParams) {
  const depts = csv(params.get('dept')).map((d) => d.toLowerCase())
  const sel = resolveCategorySelection(csv(params.get('cat')), csv(params.get('subcat')))
  const picksOf: Record<string, string[]> = {}
  for (const g of picksByCategory(sel.picks)) picksOf[g.category] = g.subs
  const activeCats = new Set([...sel.cats, ...Object.keys(picksOf)])
  return { depts, cats: sel.cats, picks: sel.picks, picksOf, activeCats }
}
/** `cat` + `subcat` URL params for a selection (null clears the param). */
const categoryParams = (cats: string[], picks: string[]) => ({ cat: cats.length ? cats.join(',') : null, subcat: picks.length ? picks.join(',') : null })

// ─── Collapsible rail section ───────────────────────────────────────────────
function Section({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <>
      <button type="button" className="rail-sec" onClick={onToggle} aria-expanded={open}>
        <span className="rail-sec__label">{label}</span>
        <span className="rail-sec__caret">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="rail__body">{children}</div>}
    </>
  )
}

function CheckRow({ label, count, on, onClick, md, swatch }: {
  label: string; count?: string; on: boolean; onClick: () => void; md?: boolean; swatch?: string
}) {
  return (
    <button type="button" className={`check-row${md ? ' check-row--md' : ''}${swatch ? ' check-row--color' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="check-row__left">
        <span className={`dot${on ? ' is-on' : ''}`} />
        {swatch && <span className="swatch" style={{ background: swatch }} />}
        <span className={`check-row__label${on ? ' is-on' : ''}`}>{label}</span>
      </span>
      {count !== undefined && <span className={`check-row__count${on ? ' is-on' : ''}`}>{count}</span>}
    </button>
  )
}

// ─── Filter rail (shared by desktop sidebar + mobile sheet) ─────────────────
function FilterRail({ params, update, clearAll, filterCounts }: {
  params: URLSearchParams
  update: (updates: Record<string, string | null>) => void
  clearAll: () => void
  filterCounts: FilterCounts
}) {
  const { depts, cats, picks, picksOf, activeCats } = readRailSelection(params)
  const brands  = csv(params.get('brand'))
  const colors  = csv(params.get('color'))
  const showOnly = {
    authenticated: params.get('authenticated') === '1',
    verified: params.get('verified') === '1',
    dropped: params.get('dropped') === '1',
    sold: params.get('sold') === '1',
  }

  const [open, setOpen] = useState({ dept: true, cat: true, designer: true, color: true, price: true, show: true })
  // Which CATEGORY trees are unfolded — pure disclosure state, never a filter. Active
  // categories start open; with nothing active the reference default (Tops) is open.
  const [tree, setTree] = useState<Record<string, boolean>>(() =>
    activeCats.size ? Object.fromEntries(Array.from(activeCats, (c) => [c, true])) : { Tops: true },
  )
  const setCategories = (nextCats: string[], nextPicks: string[]) => update(categoryParams(nextCats, nextPicks))
  const [designerQuery, setDesignerQuery] = useState('')
  const [allDesigners, setAllDesigners] = useState(false)
  const sec = (k: keyof typeof open) => () => setOpen((o) => ({ ...o, [k]: !o[k] }))

  const dq = designerQuery.trim().toLowerCase()
  const designerPool = filterCounts.brands.filter((d) => d.label.toLowerCase().includes(dq))
  const designers = allDesigners || dq ? designerPool : designerPool.slice(0, DESIGNERS_SHOWN)
  const selectedOffList = brands.filter((b) => !designers.some((d) => d.label === b))

  // COLOR: type to find (labels, then the words people use — "gray", "ivory", "khaki"),
  // tick to filter; multi-select like DESIGNER. Idle, the rail shows the colours the
  // active catalogue actually has (facet counts, list order), padded from the list to
  // eight rows; VIEW ALL or typing shows every match. Ticked colours are always listed.
  const [colorQuery, setColorQuery] = useState('')
  const [allColors, setAllColors] = useState(false)
  const cq = colorQuery.trim()
  const colorCount = (label: string) => filterCounts.colors[label] ?? 0
  let colorRows: ColorOption[]
  if (cq || allColors) colorRows = searchColors(cq)
  else {
    const present = COLORS.filter((c) => colorCount(c.label) > 0)
    colorRows = [...present, ...COLORS.filter((c) => colorCount(c.label) === 0)].slice(0, Math.max(COLORS_SHOWN, present.length))
  }
  const selectedColorsOffList = colors.filter((c) => !colorRows.some((r) => r.label === c))
  const toggleColor = (label: string) => update({ color: toggleIn(colors, label).join(',') || null })

  return (
    <aside className="rail" data-testid="filter-rail">
      <div className="rail__top">
        <span className="rail__title">FILTER</span>
        <button type="button" className="link-underline" onClick={clearAll}>CLEAR FILTERS</button>
      </div>

      <Section label="DEPARTMENT" open={open.dept} onToggle={sec('dept')}>
        {DEPARTMENTS.map((d) => {
          const on = depts.includes(d)
          return (
            <button key={d} type="button" className="opt-row" onClick={() => update({ dept: toggleIn(depts, d).join(',') || null })} aria-pressed={on}>
              <span className="opt-row__left">
                <span className={`dot${on ? ' is-on' : ''}`} />
                <span className={`opt-row__label${on ? ' is-on' : ''}`}>{cap(d)}</span>
              </span>
              <span className={`opt-row__count${on ? ' is-on' : ''}`}>{fmt(filterCounts.departments[d] ?? 0)}</span>
            </button>
          )
        })}
      </Section>

      <Section label="CATEGORY" open={open.cat} onToggle={sec('cat')}>
        {CATEGORY_TREE.map((node) => {
          const whole = cats.includes(node.label)
          const subsOn = picksOf[node.label] ?? []
          const on = activeCats.has(node.label)
          const n = filterCounts.categories[node.label] ?? 0
          const expanded = !!tree[node.label]
          const subCounts = filterCounts.subcategories[node.label] ?? {}
          return (
            <div key={node.label}>
              {/* The row only folds / unfolds its tree (+ / −). Its active state (dot, bold
                  label, bold count) follows what is ticked inside: "All <cat>" or any of its
                  subcategories. Several categories can be active at once. */}
              <button
                type="button"
                className="opt-row"
                data-testid={`cat-row-${node.label}`}
                aria-expanded={expanded}
                onClick={() => setTree((t) => ({ ...t, [node.label]: !expanded }))}
              >
                <span className="opt-row__left">
                  <span className={`dot${on ? ' is-on' : ''}`} />
                  <span className={`opt-row__label${on ? ' is-on' : ''}`}>{node.label}</span>
                </span>
                <span className={`opt-row__count${on ? ' is-on' : ''}`}>{fmt(n)}{expanded ? ' −' : ' +'}</span>
              </button>
              {expanded && (
                <div className="subtree">
                  {/* "All <cat>" = the whole category; ticking it drops that category's subcategory
                      picks, ticking a subcategory drops "All" (the picks narrow the category). */}
                  <CheckRow
                    label={`All ${node.label.toLowerCase()}`}
                    count={`(${fmt(n)})`}
                    on={whole}
                    onClick={() => (whole
                      ? setCategories(without(cats, node.label), picks)
                      : setCategories([...cats, node.label], picks.filter((k) => parseSubcatKey(k)?.category !== node.label)))}
                  />
                  {node.children.map((sub) => {
                    const key = subcatKey(node.label, sub)
                    const keyOf = (s: string) => subcatKey(node.label, s)
                    return (
                      <CheckRow
                        key={sub}
                        label={sub}
                        count={`(${fmt(subCounts[sub] ?? 0)})`}
                        // "All <cat>" shows every child ticked + active.
                        on={whole || subsOn.includes(sub)}
                        onClick={() => {
                          if (whole) {
                            // Unticking one child of "All" keeps every other child ticked.
                            setCategories(without(cats, node.label), [...picks, ...node.children.filter((s) => s !== sub).map(keyOf)])
                            return
                          }
                          const next = toggleIn(picks, key)
                          const everyChild = node.children.every((s) => next.includes(keyOf(s)))
                          // Ticking the last child = the whole category: "All" ticks itself.
                          if (everyChild) setCategories([...cats, node.label], next.filter((k) => parseSubcatKey(k)?.category !== node.label))
                          else setCategories(without(cats, node.label), next)
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </Section>

      <Section label="DESIGNER" open={open.designer} onToggle={sec('designer')}>
        <input
          className={`text-input${brands.length ? ' is-set' : ''}`}
          placeholder="Search designers"
          value={designerQuery}
          onChange={(e) => setDesignerQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter on a name that isn't in the top list filters by it directly.
            if (e.key === 'Enter' && designerQuery.trim() && designerPool.length === 0) {
              update({ brand: toggleIn(brands, designerQuery.trim().toUpperCase()).join(',') || null })
              setDesignerQuery('')
            }
          }}
          aria-label="Search designers"
        />
        <div className="rail__list">
          {selectedOffList.map((b) => (
            <CheckRow key={b} label={titleCase(b)} on onClick={() => update({ brand: toggleIn(brands, b).join(',') || null })} />
          ))}
          {designers.map((d) => {
            const on = brands.includes(d.label)
            return (
              <CheckRow
                key={d.label}
                label={titleCase(d.label)}
                count={`(${fmt(d.count)})`}
                on={on}
                onClick={() => update({ brand: toggleIn(brands, d.label).join(',') || null })}
              />
            )
          })}
          {designers.length === 0 && selectedOffList.length === 0 && (
            <div className="rail__note">No designers match — press Enter to filter by “{designerQuery.trim()}”.</div>
          )}
          {!dq && filterCounts.brands.length > DESIGNERS_SHOWN && (
            <div className="rail__viewall">
              <button type="button" className="link-underline" onClick={() => setAllDesigners((v) => !v)}>
                {allDesigners ? 'SHOW FEWER ←' : `VIEW ALL ${fmt(filterCounts.brandsTotal)}${filterCounts.brandsTotal > filterCounts.brands.length ? '+' : ''} →`}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section label="COLOR" open={open.color} onToggle={sec('color')}>
        <input
          className={`text-input${colors.length ? ' is-set' : ''}`}
          placeholder="Search colors"
          value={colorQuery}
          onChange={(e) => setColorQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter takes the typed colour: its exact label if typed in full, else the top match.
            if (e.key === 'Enter' && cq && colorRows.length) {
              e.preventDefault()
              const exact = colorRows.find((r) => r.label.toLowerCase() === cq.toLowerCase())
              toggleColor((exact ?? colorRows[0]).label)
              setColorQuery('')
            } else if (e.key === 'Escape') setColorQuery('')
          }}
          aria-label="Search colors"
          data-testid="color-search"
        />
        <div className="rail__list" data-testid="color-list">
          {selectedColorsOffList.map((label) => (
            <CheckRow key={label} label={label} swatch={colorByLabel(label)?.swatch} count={`(${fmt(colorCount(label))})`} on onClick={() => toggleColor(label)} />
          ))}
          {colorRows.map((c) => (
            <CheckRow
              key={c.label}
              label={c.label}
              swatch={c.swatch}
              count={`(${fmt(colorCount(c.label))})`}
              on={colors.includes(c.label)}
              onClick={() => toggleColor(c.label)}
            />
          ))}
          {colorRows.length === 0 && <div className="rail__note">No colors match “{cq}”.</div>}
          {!cq && (allColors || colorRows.length < COLORS.length) && (
            <div className="rail__viewall">
              <button type="button" className="link-underline" onClick={() => setAllColors((v) => !v)}>
                {allColors ? 'SHOW FEWER ←' : `VIEW ALL ${COLORS.length} →`}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section label="PRICE" open={open.price} onToggle={sec('price')}>
        <div className="price-row">
          <input
            className={`text-input${params.get('min_price') ? ' is-set' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="$ min"
            defaultValue={params.get('min_price') ?? ''}
            onBlur={(e) => { if ((e.target.value || null) !== params.get('min_price')) update({ min_price: e.target.value || null }) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            aria-label="Minimum price"
          />
          <input
            className={`text-input${params.get('max_price') ? ' is-set' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="$ max"
            defaultValue={params.get('max_price') ?? ''}
            onBlur={(e) => { if ((e.target.value || null) !== params.get('max_price')) update({ max_price: e.target.value || null }) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            aria-label="Maximum price"
          />
        </div>
      </Section>

      <div className="rail-sec rail-sec--soon">
        <span className="rail-sec__label rail-sec__label--dim">SELLER LOCATION</span>
        <span className="soon-tag">SOON</span>
      </div>

      <Section label="SHOW ONLY" open={open.show} onToggle={sec('show')}>
        {SHOW_ONLY.map((s) => (
          <CheckRow
            key={s.id}
            md
            label={s.label}
            count={fmt(filterCounts.showOnly[s.id])}
            on={showOnly[s.id]}
            onClick={() => update({ [s.id]: showOnly[s.id] ? null : '1' })}
          />
        ))}
      </Section>

      <div className="rail-sec rail-sec--static">
        <span className="rail-sec__label rail-sec__label--dim">FOLLOWED SEARCHES</span>
        <span className="soon-tag">SOON</span>
      </div>
      <div className="rail__note">Searches you follow will alert you here.</div>
    </aside>
  )
}

// ─── Main client component ───────────────────────────────────────────────────
export default function BrowseClient({
  initialListings,
  totalCount,
  filterCounts,
  initialSavedIds,
  userSizes,
  mySizesOn,
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

  // Empty userId ⇒ signed-out visitor. Guests browse freely; any write
  // (save, follow-search, sizes) opens the sign-in popup instead of the API.
  const isGuest = !userId

  const [extraListings, setExtraListings]   = useState<BrowseListing[]>([])
  const [extraSaved, setExtraSaved]         = useState<Set<string>>(new Set())
  const [hasMore, setHasMore]               = useState(initialHasMore)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [savedIds, setSavedIds]             = useState(() => new Set(initialSavedIds))
  const [sheetOpen, setSheetOpen]           = useState(false)
  const [sortOpen, setSortOpen]             = useState(false)
  const [sortMenuOpen, setSortMenuOpen]     = useState(false)  // desktop dropdown
  const [sizesOpen, setSizesOpen]           = useState(false)
  const [followPending, setFollowPending]   = useState(false)
  const [followedMsg, setFollowedMsg]       = useState('')
  const [bumped, setBumped]                 = useState<Set<string>>(new Set())

  const q       = searchParams.get('q') ?? ''
  const { depts, cats, picks } = readRailSelection(searchParams)
  const size    = searchParams.get('size') ?? ''
  const brands  = csv(searchParams.get('brand'))
  const colors  = csv(searchParams.get('color'))
  const minPrice = searchParams.get('min_price') ?? ''
  const maxPrice = searchParams.get('max_price') ?? ''
  const cond    = searchParams.get('cond') ?? ''
  const verified = searchParams.get('verified') === '1'
  const authenticated = searchParams.get('authenticated') === '1'
  const dropped  = searchParams.get('dropped') === '1'
  const sold     = searchParams.get('sold') === '1'
  const sort    = searchParams.get('sort') ?? 'newest'
  const sizeChip = sizesChipLabel(userSizes)

  const allListings = [...initialListings, ...extraListings]
  const nextOffset  = currentOffset + initialListings.length

  // ── recs telemetry: init once; observe impressions as the grid grows ────────
  useEffect(() => {
    if (!recsTelemetryEnabled || !userId) return
    recsInit(userId)
    mergeRecsIdentity(userId)
    return () => recsShutdown()
  }, [recsTelemetryEnabled, userId])

  const shownCount = allListings.length
  useEffect(() => {
    if (!recsTelemetryEnabled || shownCount === 0) return
    const disconnect = observeImpressions(document)
    return disconnect
  }, [recsTelemetryEnabled, shownCount])

  // Escape closes the mobile takeover / sort sheet (the × and the scrim do too).
  useEffect(() => {
    if (!sheetOpen && !sortOpen && !sortMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSheetOpen(false); setSortOpen(false); setSortMenuOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, sortOpen, sortMenuOpen])

  function buildUrl(updates: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('offset') // reset pagination on any change
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    const qs = p.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    setExtraListings([])
    setHasMore(false)
    startTransition(() => {
      router.push(buildUrl(updates))
    })
    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'q' && key !== 'sort') trackEvent('filter_applied', { filter: key, value: val ?? '' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname])
  const updateFilter = (key: string, val: string | null) => updateFilters({ [key]: val })

  function clearAll() {
    setExtraListings([])
    setHasMore(false)
    startTransition(() => {
      // CLEAR turns MY SIZES off too (16A) — my_sizes=0 overrides the profile default for this visit.
      router.push(mySizesOn ? `${pathname}?my_sizes=0` : pathname)
    })
  }

  // ── MY SIZES ───────────────────────────────────────────────────────────────
  function toggleMySizes() {
    if (isGuest) { openAuthModal(pathname); return }
    if (!mySizesOn && sizeChip === 'NONE SET') { setSizesOpen(true); return }
    updateFilter('my_sizes', mySizesOn ? '0' : '1')
  }
  function editSizes() {
    if (isGuest) { openAuthModal(pathname); return }
    setSizesOpen(true)
  }

  // ── Save / unsave ──────────────────────────────────────────────────────────
  async function handleSaveToggle(listingId: string, currentlySaved: boolean) {
    if (isGuest) {
      // Guest save gate (mobile-web 25): the popup names the item they tried to save.
      const l = allListings.find((x) => x.id === listingId)
      openAuthModal(pathname, l ? {
        title: 'SIGN IN TO SAVE',
        cta: 'SIGN IN & SAVE →',
        listing: { brand: l.brand, title: l.title, image: l.images[0] ?? null },
      } : undefined)
      return
    }
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (currentlySaved) next.delete(listingId)
      else next.add(listingId)
      return next
    })
    const res = await fetch('/api/saves', {
      method: currentlySaved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })
    if (!res.ok) {
      setSavedIds((prev) => {
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

  // ── BUMP ↗ on the viewer's own cards ───────────────────────────────────────
  async function handleBump(listingId: string) {
    if (bumped.has(listingId)) return
    const res = await fetch(`/api/listings/${listingId}/bump`, { method: 'POST' })
    if (res.ok || res.status === 422) setBumped((prev) => new Set(prev).add(listingId))
  }

  // ── Load more ──────────────────────────────────────────────────────────────
  const inFlightRef = useRef(false)
  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return
    if (isGuest) { openAuthModal(pathname); return } // deeper pages ask for an account
    inFlightRef.current = true
    setLoadingMore(true)
    const p = new URLSearchParams(searchParams.toString())
    p.set('offset', String(nextOffset + extraListings.length))
    if (mySizesOn) p.set('my_sizes', '1')
    const res = await fetch(`/api/browse?${p.toString()}`)
    if (res.ok) {
      const json = await res.json() as { listings: BrowseListing[]; hasMore: boolean; savedIds: string[] }
      setExtraListings((prev) => [...prev, ...json.listings])
      setHasMore(json.hasMore)
      setExtraSaved((prev) => {
        const next = new Set(prev)
        json.savedIds.forEach((id) => next.add(id))
        return next
      })
    }
    setLoadingMore(false)
    inFlightRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, searchParams, nextOffset, extraListings.length, mySizesOn, isGuest, pathname])

  // ── Infinite scroll — sentinel below the grid, pre-fetches 600px early ─────
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore || isGuest) return
    if (typeof IntersectionObserver === 'undefined') return
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) void loadMore() },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore, isGuest])

  // ── Follow search ──────────────────────────────────────────────────────────
  async function followSearch() {
    if (isGuest) {
      openAuthModal(pathname)
      return
    }
    setFollowPending(true)
    const query: Record<string, string> = {}
    for (const k of ['q', 'dept', 'cat', 'subcat', 'size', 'brand', 'color', 'min_price', 'max_price', 'cond', 'verified', 'authenticated', 'dropped', 'sold']) {
      const v = searchParams.get(k)
      if (v) query[k] = v
    }
    if (sort !== 'newest') query.sort = sort

    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    setFollowPending(false)
    setFollowedMsg(res.ok ? 'SEARCH SAVED ✓' : 'ERROR — TRY AGAIN')
    setTimeout(() => setFollowedMsg(''), 3000)
  }

  const isSaved = (id: string) => savedIds.has(id) || extraSaved.has(id)

  // ── Chips ──────────────────────────────────────────────────────────────────
  type Chip = { id: string; label: string; solid?: boolean; onClick?: () => void; onRemove?: () => void }
  const chips: Chip[] = []
  if (q)     chips.push({ id: 'q', label: `“${q}”`, onRemove: () => updateFilter('q', null) })
  for (const d of depts) chips.push({ id: `dept:${d}`, label: d.toUpperCase(), onRemove: () => updateFilter('dept', toggleIn(depts, d).join(',') || null) })
  for (const c of cats) chips.push({ id: `cat:${c}`, label: c.toUpperCase(), onRemove: () => updateFilters(categoryParams(without(cats, c), picks)) })
  for (const k of picks) {
    const p = parseSubcatKey(k)
    if (!p) continue
    // A label that lives under two categories (Denim) is prefixed so the chip is unambiguous.
    const label = categoriesWithSubcategory(p.sub).length > 1 ? `${p.category} / ${p.sub}` : p.sub
    chips.push({ id: `sub:${k}`, label: label.toUpperCase(), onRemove: () => updateFilters(categoryParams(cats, without(picks, k))) })
  }
  if (mySizesOn) chips.push({ id: 'sizes', label: `MY SIZES — ${sizeChip}`, solid: true, onClick: () => setSizesOpen(true) })
  if (size)  chips.push({ id: 'size', label: `SIZE ${size.toUpperCase()}`, onRemove: () => updateFilter('size', null) })
  for (const b of brands) chips.push({ id: `brand:${b}`, label: b.toUpperCase(), onRemove: () => updateFilter('brand', toggleIn(brands, b).join(',') || null) })
  for (const c of colors) chips.push({ id: `color:${c}`, label: c.toUpperCase(), onRemove: () => updateFilter('color', toggleIn(colors, c).join(',') || null) })
  if (verified) chips.push({ id: 'verified', label: 'VERIFIED', onRemove: () => updateFilter('verified', null) })
  if (authenticated) chips.push({ id: 'auth', label: 'AUTHENTICATED', onRemove: () => updateFilter('authenticated', null) })
  if (dropped) chips.push({ id: 'dropped', label: 'PRICE DROPPED', onRemove: () => updateFilter('dropped', null) })
  if (sold) chips.push({ id: 'sold', label: 'SOLD ITEMS', onRemove: () => updateFilter('sold', null) })
  if (minPrice) chips.push({ id: 'min', label: `MIN $${minPrice}`, onRemove: () => updateFilter('min_price', null) })
  if (maxPrice) chips.push({ id: 'max', label: `MAX $${maxPrice}`, onRemove: () => updateFilter('max_price', null) })
  if (cond)  chips.push({ id: 'cond', label: `CONDITION ${cond}+`, onRemove: () => updateFilter('cond', null) })

  const sortIndex = Math.max(0, SORTS.findIndex((o) => o.value === sort))
  const pickSort = (value: string) => { setSortOpen(false); if (value !== SORTS[sortIndex].value) updateFilter('sort', value) }

  const scopeDept = departmentScopeLabel(depts)
  const scopeCat = categoryScopeLabel({ cats, picks })

  const rail = (
    <FilterRail
      params={searchParams}
      update={updateFilters}
      clearAll={clearAll}
      filterCounts={filterCounts}
    />
  )

  const shownLabel = `SHOWING ${fmt(allListings.length)} OF ${fmt(totalCount)}`

  return (
    <div className="browse-page">
      <div className="layout">
        {rail}
        <main className="main" style={{ opacity: isPending ? 0.55 : 1, transition: 'opacity 200ms' }}>
          {/* Results header (16A) */}
          <div className="results">
            <div className="results__lead">
              <span className="results__count" data-testid="results-count">{fmt(totalCount)}</span>
              <span className="results__meta">
                {q ? <>results for <strong>“{q}”</strong></> : <>results in <strong>{scopeDept} / {scopeCat}</strong></>}
              </span>
            </div>
            <div className="results__actions">
              <button type="button" className="mysizes-toggle" onClick={toggleMySizes} aria-pressed={mySizesOn} data-testid={isGuest ? 'add-sizes-guest' : 'my-sizes-toggle'}>
                <span className="mysizes-toggle__label">MY SIZES:</span>
                {mySizesOn ? <span className="pill-on">ON</span> : <span className="pill-off">OFF</span>}
              </button>
              <button type="button" className="link-btn results__edit" onClick={editSizes}>EDIT SIZES</button>
              <button type="button" className="link-btn results__save" onClick={followSearch} disabled={followPending} data-testid="follow-search-btn">
                {followedMsg || 'SAVE SEARCH +'}
              </button>
              <span className="sort-dd">
                <button type="button" className="btn-outline results__sort" onClick={() => setSortMenuOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={sortMenuOpen} data-testid="sort-dropdown-btn">
                  SORT: {SORTS[sortIndex].label}<CaretDown size={10} aria-hidden="true" />
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="notif-overlay" onClick={() => setSortMenuOpen(false)} />
                    <div className="sort-menu" role="listbox" aria-label="Sort" data-testid="sort-menu">
                      {SORTS.map((o, i) => {
                        const on = i === sortIndex
                        return (
                          <button key={o.value} type="button" role="option" aria-selected={on} className={`sort-menu__opt${on ? ' is-on' : ''}`} onClick={() => { setSortMenuOpen(false); if (!on) updateFilter('sort', o.value) }} data-testid={`sort-option-${o.value}`}>
                            <span className={`checkbox${on ? ' is-on' : ''}`}>{on && <CheckIcon size={9} />}</span>
                            <span className="sort-menu__label">{o.label}</span>
                            <span className="sort-menu__hint">{o.hint}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="chips" data-testid="active-chips">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip${c.solid ? ' chip--solid' : ''}`}
                  onClick={c.onClick ?? c.onRemove}
                  aria-label={c.onRemove ? `Remove filter: ${c.label}` : c.label}
                >
                  {c.label}
                  {!c.solid && c.onRemove && <XIcon />}
                </button>
              ))}
              <button type="button" className="chip-clear" onClick={clearAll}>CLEAR ALL ({chips.length})</button>
            </div>
          )}

          {/* Grid */}
          {allListings.length === 0 ? (
            <div className="empty" data-testid="browse-empty">
              <div className="empty__title">Nothing in the archive matches.</div>
              <div className="empty__sub">TRY FEWER FILTERS, OR SAVE THIS SEARCH AND WE&rsquo;LL ALERT YOU</div>
              <div className="empty__cta">
                <button type="button" className="link-underline link-underline--ink" onClick={followSearch} disabled={followPending}>
                  {followedMsg || 'SAVE THIS SEARCH →'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid" data-testid="listings-grid">
                {allListings.map((l, i) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isSaved={isSaved(l.id)}
                    onSaveToggle={handleSaveToggle}
                    position={i}
                    own={l.own || (!!username && l.seller?.username === username)}
                    unavailable={l.sold}
                    onBump={handleBump}
                    bumped={bumped.has(l.id)}
                    showAuthBadge={authBadgeEnabled}
                    onProductClick={(id) => trackClick(id, 'feed')}
                  />
                ))}
              </div>

              {/* Infinite scroll sentinel — observer pre-fetches 600px early */}
              <div ref={sentinelRef} data-testid="scroll-sentinel" style={{ height: 1 }} />

              {hasMore ? (
                <button type="button" className="load-more" onClick={loadMore} disabled={loadingMore} data-testid="load-more-btn">
                  <span data-testid="loading-more">{loadingMore ? 'LOADING…' : `LOAD MORE — ${shownLabel}`}</span>
                </button>
              ) : (
                <div className="rows-note" style={{ textAlign: 'center', paddingTop: 44 }} data-testid="end-of-archive">
                  END OF THE ARCHIVE<span className="sep" aria-hidden="true" />{shownLabel}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile-web dock (≤720px, 01): fixed at the viewport bottom, part of this page. */}
      <div className="dock" data-testid="browse-dock">
        <button type="button" className="dock__btn" onClick={() => setSheetOpen(true)} data-testid="mobile-filter-btn">
          <FilterIcon />
          FILTERS{chips.length > 0 && <><span className="sep" aria-hidden="true" />{chips.length}</>}
        </button>
        <button type="button" className="dock__btn" onClick={() => setSortOpen(true)} data-testid="mobile-sort-btn">
          SORT<span className="sep" aria-hidden="true" />{SORTS[sortIndex].label}
        </button>
      </div>

      {/* Filter takeover (02): full-screen over the page. */}
      {sheetOpen && (
        <div className="filter-sheet" role="dialog" aria-modal="true" aria-label="Filters" data-testid="mobile-filter-drawer">
          <div className="filter-sheet__head">
            <span className="modal__title">FILTER{chips.length > 0 ? ` (${chips.length})` : ''}</span>
            <span className="filter-sheet__tools">
              <button type="button" className="link-underline filter-sheet__clear" onClick={clearAll}>CLEAR FILTERS</button>
              <button type="button" className="modal__close" aria-label="Close filters" onClick={() => setSheetOpen(false)}>
                <XIcon size={12} strokeWidth={1.2} />
              </button>
            </span>
          </div>
          <div className="filter-sheet__body">
            {/* MY SIZES lives in the takeover on mobile (the results head keeps only the count +
                SAVE SEARCH). Anything that opens a sheet (the sizes editor, the guest sign-in)
                closes the takeover first so the sheet sits over the page (04). */}
            <div className="sheet-sizes">
              <button
                type="button"
                className="mysizes-toggle"
                onClick={() => { if (isGuest || (!mySizesOn && sizeChip === 'NONE SET')) setSheetOpen(false); toggleMySizes() }}
                aria-pressed={mySizesOn}
                data-testid="sheet-my-sizes-toggle"
              >
                <span className="rail-sec__label">MY SIZES</span>
                {mySizesOn ? <span className="pill-on">ON</span> : <span className="pill-off">OFF</span>}
              </button>
              <button type="button" className="link-underline" onClick={() => { setSheetOpen(false); editSizes() }}>EDIT SIZES</button>
            </div>
            {rail}
          </div>
          <div className="filter-sheet__foot">
            <button type="button" className="btn-primary" onClick={() => setSheetOpen(false)} data-testid="drawer-show-btn">
              SHOW {fmt(totalCount)} RESULTS
            </button>
          </div>
        </div>
      )}

      {/* Sort sheet (03): bottom sheet over the dimmed page. */}
      {sortOpen && (
        <div className="scrim scrim--sheet" onClick={() => setSortOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Sort" onClick={(e) => e.stopPropagation()} data-testid="sort-sheet">
            <div className="sheet__head">
              <span className="modal__title">SORT</span>
              <button type="button" className="modal__close" aria-label="Close" onClick={() => setSortOpen(false)}>
                <XIcon size={11} strokeWidth={1.2} />
              </button>
            </div>
            {SORTS.map((o, i) => {
              const on = i === sortIndex
              return (
                <button key={o.value} type="button" className="sheet-row" onClick={() => pickSort(o.value)} aria-pressed={on}>
                  <span className="sheet-row__left">
                    <span className={`checkbox${on ? ' is-on' : ''}`}>{on && <CheckIcon size={9} />}</span>
                    <span className={`sheet-row__label${on ? ' is-on' : ''}`}>{o.label}</span>
                  </span>
                  <span className="sheet-row__hint">{o.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!isGuest && (
        <SizesModal
          open={sizesOpen}
          onClose={() => setSizesOpen(false)}
          initialSizes={userSizes}
          onSaved={() => { if (!mySizesOn) updateFilter('my_sizes', '1') }}
        />
      )}
    </div>
  )
}
