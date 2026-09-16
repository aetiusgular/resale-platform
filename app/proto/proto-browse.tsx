'use client'

import { useMemo, useState, useEffect, type ReactNode } from 'react'
import ListingCard from '@/app/components/listing-card'
import LotsCarousel from '@/app/components/lots-carousel'
import { FilterIcon, XIcon } from '@/app/components/icons'
import { CaretDown, Check } from '@phosphor-icons/react/ssr'
import { CATEGORY_TREE, COLORS, parseSubcatKey, picksByCategory, subcatKey } from '@/lib/taxonomy'
import { pickMoreLots } from '@/app/browse/more-lots'
import { PROTO_LISTINGS } from './fixtures'

/** Fixture departments — the prototype catalog is seeded womens/mens only. */
const DEPTS = [
  { id: 'womens', label: 'Womens' },
  { id: 'mens', label: 'Mens' },
] as const

const SORTS = [
  { value: 'newest', label: 'NEWEST', hint: 'DEFAULT' },
  { value: 'price_asc', label: 'PRICE ↑', hint: 'LOW TO HIGH' },
  { value: 'price_desc', label: 'PRICE ↓', hint: 'HIGH TO LOW' },
] as const

const SHOW_ONLY: Array<{ id: 'authenticated' | 'verified' | 'dropped' | 'sold'; label: string }> = [
  { id: 'authenticated', label: 'Authenticated' },
  { id: 'verified', label: 'Verified sellers' },
  { id: 'dropped', label: 'Price dropped' },
  { id: 'sold', label: 'Sold items' },
]

const DESIGNERS_SHOWN = 5

const fmt = (n: number) => n.toLocaleString('en-US')
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(-])([a-zà-ÿ])/g, (m) => m.toUpperCase())
const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
const without = (list: string[], v: string) => list.filter((x) => x !== v)

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

export default function ProtoBrowse({ hrefBase }: { hrefBase: string }) {
  const [depts, setDepts] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [picks, setPicks] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [price, setPrice] = useState<{ min: string; max: string }>({ min: '', max: '' })
  const [showOnly, setShowOnly] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Set<string>>(() => new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tree, setTree] = useState<Record<string, boolean>>({ Tops: true })
  const [open, setOpen] = useState({ dept: true, cat: true, designer: true, color: true, price: true, show: true })
  const [designerQuery, setDesignerQuery] = useState('')
  const [allDesigners, setAllDesigners] = useState(false)
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('newest')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  const sec = (k: keyof typeof open) => () => setOpen((o) => ({ ...o, [k]: !o[k] }))

  // Escape closes the sort dropdown; the .notif-overlay handles click-away (as on /browse).
  useEffect(() => {
    if (!sortMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sortMenuOpen])

  // Active categories = whole categories plus any category with subcategory picks (as on /browse).
  const picksOf = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const g of picksByCategory(picks)) out[g.category] = g.subs
    return out
  }, [picks])
  const activeCats = useMemo(() => new Set([...cats, ...Object.keys(picksOf)]), [cats, picksOf])

  const filtered = useMemo(() => {
    const min = price.min ? Number(price.min) * 100 : null
    const max = price.max ? Number(price.max) * 100 : null
    return PROTO_LISTINGS.filter((l) => {
      if (depts.length && !depts.includes(l.department)) return false
      if (activeCats.size && !activeCats.has(l.category)) return false
      if (brands.length && !brands.includes(l.brand)) return false
      if (colors.length && !colors.includes(l.color)) return false
      if (min !== null && l.price_cents < min) return false
      if (max !== null && l.price_cents > max) return false
      if (showOnly.authenticated && l.authentication_status !== 'authenticated') return false
      if (showOnly.verified && l.seller?.id_verification_status !== 'verified') return false
      if (showOnly.dropped && !l.is_price_dropped) return false
      if (showOnly.sold && !l.sold) return false
      return true
    })
  }, [depts, activeCats, brands, colors, price, showOnly])

  const listings = useMemo(() => {
    const rows = [...filtered]
    if (sort === 'price_asc') rows.sort((a, b) => a.price_cents - b.price_cents)
    else if (sort === 'price_desc') rows.sort((a, b) => b.price_cents - a.price_cents)
    else rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    return rows
  }, [filtered, sort])

  const moreLots = useMemo(
    () => pickMoreLots(PROTO_LISTINGS, { excludeIds: listings.map((l) => l.id) }),
    [listings],
  )

  const clear = () => {
    setDepts([]); setCats([]); setPicks([]); setBrands([]); setColors([])
    setPrice({ min: '', max: '' }); setShowOnly({})
  }
  const setCategories = (nextCats: string[], nextPicks: string[]) => { setCats(nextCats); setPicks(nextPicks) }

  const sortIndex = Math.max(0, SORTS.findIndex((o) => o.value === sort))
  const sortLabel = SORTS[sortIndex].label

  // Facet counts off the fixture set — the prototype's stand-in for FilterCounts on /browse.
  const counts = useMemo(() => {
    const tally = <T,>(pick: (l: (typeof PROTO_LISTINGS)[number]) => T) =>
      PROTO_LISTINGS.reduce<Map<T, number>>((m, l) => m.set(pick(l), (m.get(pick(l)) ?? 0) + 1), new Map())
    const brandTally = tally((l) => l.brand)
    return {
      departments: tally((l) => l.department),
      categories: tally((l) => l.category),
      colors: tally((l) => l.color),
      brands: [...brandTally.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      showOnly: {
        authenticated: PROTO_LISTINGS.filter((l) => l.authentication_status === 'authenticated').length,
        verified: PROTO_LISTINGS.filter((l) => l.seller?.id_verification_status === 'verified').length,
        dropped: PROTO_LISTINGS.filter((l) => l.is_price_dropped).length,
        sold: PROTO_LISTINGS.filter((l) => l.sold).length,
      } as Record<string, number>,
    }
  }, [])

  const activeCount = depts.length + cats.length + picks.length + brands.length + colors.length
    + (price.min ? 1 : 0) + (price.max ? 1 : 0) + SHOW_ONLY.filter((s) => showOnly[s.id]).length

  const dq = designerQuery.trim().toLowerCase()
  const designerPool = counts.brands.filter((d) => d.label.toLowerCase().includes(dq))
  const designers = allDesigners || dq ? designerPool : designerPool.slice(0, DESIGNERS_SHOWN)
  const selectedOffList = brands.filter((b) => !designers.some((d) => d.label === b))

  const rail = (
    <aside className="rail" data-testid="filter-rail">
      <div className="rail__top">
        <span className="rail__title">FILTER</span>
        <button type="button" className="link-underline" onClick={clear}>CLEAR FILTERS</button>
      </div>
      <Section label="DEPARTMENT" open={open.dept} onToggle={sec('dept')}>
        {DEPTS.map((d) => {
          const on = depts.includes(d.id)
          return (
            <button key={d.id} type="button" className="opt-row" onClick={() => setDepts((cur) => toggleIn(cur, d.id))} aria-pressed={on}>
              <span className="opt-row__left">
                <span className={`dot${on ? ' is-on' : ''}`} />
                <span className={`opt-row__label${on ? ' is-on' : ''}`}>{d.label}</span>
              </span>
              <span className={`opt-row__count${on ? ' is-on' : ''}`}>{fmt(counts.departments.get(d.id) ?? 0)}</span>
            </button>
          )
        })}
      </Section>

      <Section label="CATEGORY" open={open.cat} onToggle={sec('cat')}>
        {CATEGORY_TREE.map((node) => {
          const whole = cats.includes(node.label)
          const subsOn = picksOf[node.label] ?? []
          const on = activeCats.has(node.label)
          const n = counts.categories.get(node.label) ?? 0
          const expanded = !!tree[node.label]
          return (
            <div key={node.label}>
              {/* The row only folds / unfolds its tree (+ / −). Its active state follows what is
                  ticked inside: "All <cat>" or any of its subcategories. */}
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
                      picks, ticking a subcategory drops "All". */}
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
                        // Fixtures carry no subcategory, so every child reads (0) — as on /browse
                        // when a subcategory has no inventory.
                        count="(0)"
                        on={whole || subsOn.includes(sub)}
                        onClick={() => {
                          if (whole) {
                            setCategories(without(cats, node.label), [...picks, ...node.children.filter((s) => s !== sub).map(keyOf)])
                            return
                          }
                          const next = toggleIn(picks, key)
                          const everyChild = node.children.every((s) => next.includes(keyOf(s)))
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
          aria-label="Search designers"
        />
        <div className="rail__list">
          {selectedOffList.map((b) => (
            <CheckRow key={b} label={titleCase(b)} on onClick={() => setBrands((cur) => toggleIn(cur, b))} />
          ))}
          {designers.map((d) => (
            <CheckRow
              key={d.label}
              label={titleCase(d.label)}
              count={`(${fmt(d.count)})`}
              on={brands.includes(d.label)}
              onClick={() => setBrands((cur) => toggleIn(cur, d.label))}
            />
          ))}
          {designers.length === 0 && selectedOffList.length === 0 && (
            <div className="rail__note">No designers match.</div>
          )}
          {!dq && counts.brands.length > DESIGNERS_SHOWN && (
            <div className="rail__viewall">
              <button type="button" className="link-underline" onClick={() => setAllDesigners((v) => !v)}>
                {allDesigners ? 'SHOW FEWER ←' : `VIEW ALL ${fmt(counts.brands.length)} →`}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section label="COLOR" open={open.color} onToggle={sec('color')}>
        {COLORS.map((c) => (
          <CheckRow
            key={c.label}
            label={c.label}
            swatch={c.swatch}
            count={`(${fmt(counts.colors.get(c.label) ?? 0)})`}
            on={colors.includes(c.label)}
            onClick={() => setColors((cur) => toggleIn(cur, c.label))}
          />
        ))}
      </Section>

      <Section label="PRICE" open={open.price} onToggle={sec('price')}>
        <div className="price-row">
          <input
            className={`text-input${price.min ? ' is-set' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="$ min"
            value={price.min}
            onChange={(e) => setPrice((p) => ({ ...p, min: e.target.value }))}
            aria-label="Minimum price"
          />
          <input
            className={`text-input${price.max ? ' is-set' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="$ max"
            value={price.max}
            onChange={(e) => setPrice((p) => ({ ...p, max: e.target.value }))}
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
            count={fmt(counts.showOnly[s.id] ?? 0)}
            on={!!showOnly[s.id]}
            onClick={() => setShowOnly((cur) => ({ ...cur, [s.id]: !cur[s.id] }))}
          />
        ))}
      </Section>

      <div className="rail-sec rail-sec--static">
        <span className="rail-sec__label rail-sec__label--dim">FOLLOWED SEARCHES</span>
        <span className="soon-tag">SOON</span>
      </div>
      <div className="rail__note">Prototype catalog — fixture listings, no live inventory.</div>
    </aside>
  )

  return (
    <div className="browse-page">
      <div className="layout">
        {rail}
        <main className="main">
          <div className="results">
            <div className="results__lead">
              <span className="results__count" data-testid="results-count">{fmt(listings.length)}</span>
              <span className="results__meta">
                results in <strong>All / All categories</strong>
              </span>
            </div>
            <div className="results__actions">
              <span className="mysizes-toggle" aria-disabled>
                <span className="mysizes-toggle__label">MY SIZES:</span>
                <span className="pill-off">OFF</span>
              </span>
              <span className="link-btn results__edit" aria-disabled>EDIT SIZES</span>
              <span className="link-btn results__save" aria-disabled>SAVE SEARCH +</span>
              <span className="sort-dd">
                <button type="button" className="btn-outline results__sort" onClick={() => setSortMenuOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={sortMenuOpen} data-testid="sort-dropdown-btn">
                  SORT: {sortLabel}<CaretDown size={10} aria-hidden="true" />
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="notif-overlay" onClick={() => setSortMenuOpen(false)} />
                    <div className="sort-menu" role="listbox" aria-label="Sort" data-testid="sort-menu">
                      {SORTS.map((o, i) => {
                        const on = i === sortIndex
                        return (
                          <button key={o.value} type="button" role="option" aria-selected={on} className={`sort-menu__opt${on ? ' is-on' : ''}`} onClick={() => { setSortMenuOpen(false); if (!on) setSort(o.value) }} data-testid={`sort-option-${o.value}`}>
                            <span className={`checkbox${on ? ' is-on' : ''}`}>{on && <Check size={9} weight="bold" />}</span>
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

          <div className="grid" data-testid="listings-grid">
            {listings.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                href={`${hrefBase}/${l.id}`}
                isSaved={saved.has(l.id)}
                onSaveToggle={(id, wasSaved) => {
                  setSaved((prev) => {
                    const next = new Set(prev)
                    if (wasSaved) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }}
                position={i}
                unavailable={l.sold}
                showAuthBadge
              />
            ))}
          </div>
          <div className="rows-note" style={{ textAlign: 'center', paddingTop: 44 }}>
            END OF THE ARCHIVE<span className="sep" aria-hidden="true" />SHOWING {fmt(listings.length)} OF {fmt(PROTO_LISTINGS.length)}
          </div>
          <LotsCarousel
            listings={moreLots}
            label="also in the archive"
            hrefBase={hrefBase}
            isSaved={(id) => saved.has(id)}
            onSaveToggle={(id, wasSaved) => {
              setSaved((prev) => {
                const next = new Set(prev)
                if (wasSaved) next.delete(id)
                else next.add(id)
                return next
              })
            }}
          />
        </main>
      </div>

      <div className="dock" data-testid="browse-dock">
        <button type="button" className="dock__btn" onClick={() => setSheetOpen(true)}>
          <FilterIcon />
          FILTERS{activeCount > 0 && <><span className="sep" aria-hidden="true" />{activeCount}</>}
        </button>
        <button type="button" className="dock__btn" data-testid="mobile-sort-btn">
          SORT<span className="sep" aria-hidden="true" />{sortLabel}
        </button>
      </div>

      {sheetOpen && (
        <div className="filter-sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="filter-sheet__head">
            <span className="modal__title">FILTER</span>
            <span className="filter-sheet__tools">
              <button type="button" className="link-underline filter-sheet__clear" onClick={clear}>CLEAR FILTERS</button>
              <button type="button" className="modal__close" aria-label="Close filters" onClick={() => setSheetOpen(false)}>
                <XIcon size={12} strokeWidth={1.2} />
              </button>
            </span>
          </div>
          <div className="filter-sheet__body">{rail}</div>
          <div className="filter-sheet__foot">
            <button type="button" className="btn-primary" onClick={() => setSheetOpen(false)}>
              SHOW {fmt(listings.length)} RESULTS
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
