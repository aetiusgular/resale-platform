'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import ListingCard from '@/app/components/listing-card'
import { FilterIcon, XIcon } from '@/app/components/icons'
import { CATEGORY_TREE } from '@/lib/taxonomy'
import { PROTO_LISTINGS } from './fixtures'

const DEPTS = [
  { id: 'womens', label: 'Womens' },
  { id: 'mens', label: 'Mens' },
] as const

const SORTS = [
  { value: 'newest', label: 'NEWEST' },
  { value: 'price_asc', label: 'PRICE ↑' },
  { value: 'price_desc', label: 'PRICE ↓' },
] as const

function CheckRow({ label, count, on, onClick, mark = 'row' }: {
  label: string; count?: string; on: boolean; onClick: () => void; mark?: 'parent' | 'child' | 'row'
}) {
  return (
    <button type="button" className={`check-row${mark === 'child' ? ' check-row--sub' : ''}${on ? ' is-on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="check-row__left">
        <span className={`sq ${mark === 'parent' ? 'sq--lg' : 'sq--sm'}${on ? ' is-on' : ''}`} aria-hidden />
        <span className={`check-row__label${on ? ' is-on' : ''}`}>{label}</span>
      </span>
      {count !== undefined && <span className={`check-row__count${on ? ' is-on' : ''}`}>{count}</span>}
    </button>
  )
}

export default function ProtoBrowse({ hrefBase }: { hrefBase: string }) {
  const [depts, setDepts] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [saved, setSaved] = useState<Set<string>>(() => new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tree, setTree] = useState<Record<string, boolean>>({ Tops: true })
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('newest')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sortMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!sortWrapRef.current?.contains(e.target as Node)) setSortMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [sortMenuOpen])

  const filtered = useMemo(() => {
    return PROTO_LISTINGS.filter((l) => {
      if (depts.length && !depts.includes(l.department)) return false
      if (cats.length && !cats.includes(l.category)) return false
      return true
    })
  }, [depts, cats])

  const listings = useMemo(() => {
    const rows = [...filtered]
    if (sort === 'price_asc') rows.sort((a, b) => a.price_cents - b.price_cents)
    else if (sort === 'price_desc') rows.sort((a, b) => b.price_cents - a.price_cents)
    else rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    return rows
  }, [filtered, sort])

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const clear = () => { setDepts([]); setCats([]) }
  const fmt = (n: number) => n.toLocaleString('en-US')
  const sortLabel = SORTS.find((o) => o.value === sort)?.label ?? 'NEWEST'
  const catCount = (label: string) => PROTO_LISTINGS.filter((l) => l.category === label).length

  const rail = (
    <aside className="rail" data-testid="filter-rail">
      <div className="rail__top">
        <span className="rail__title">FILTER</span>
        <button type="button" className="link-underline" onClick={clear}>CLEAR FILTERS</button>
      </div>
      <button type="button" className="rail-sec" aria-expanded>
        <span className="rail-sec__label">DEPARTMENT</span>
        <span className="rail-sec__caret">−</span>
      </button>
      <div className="rail__body">
        {DEPTS.map((d) => (
          <CheckRow
            key={d.id}
            label={d.label}
            count={`(${fmt(PROTO_LISTINGS.filter((l) => l.department === d.id).length)})`}
            on={depts.includes(d.id)}
            onClick={() => setDepts((cur) => toggle(cur, d.id))}
          />
        ))}
      </div>
      <button type="button" className="rail-sec" aria-expanded>
        <span className="rail-sec__label">CATEGORY</span>
        <span className="rail-sec__caret">−</span>
      </button>
      <div className="rail__body">
        {CATEGORY_TREE.map((node) => {
          const n = catCount(node.label)
          const on = cats.includes(node.label)
          const expanded = !!tree[node.label]
          return (
            <div key={node.label}>
              <button
                type="button"
                className="opt-row"
                data-testid={`cat-row-${node.label}`}
                aria-expanded={expanded}
                onClick={() => setTree((t) => ({ ...t, [node.label]: !expanded }))}
              >
                <span className="opt-row__left">
                  <span className={`opt-row__label${on ? ' is-on' : ''}`}>{node.label}</span>
                </span>
                <span className={`opt-row__count${on ? ' is-on' : ''}`}>{fmt(n)}{expanded ? ' −' : ' +'}</span>
              </button>
              {expanded && (
                <div className="subtree">
                  <CheckRow
                    mark="parent"
                    label={`All ${node.label.toLowerCase()}`}
                    count={`(${fmt(n)})`}
                    on={on}
                    onClick={() => setCats((cur) => toggle(cur, node.label))}
                  />
                  {node.children.map((sub) => (
                    <CheckRow
                      key={sub}
                      mark="child"
                      label={sub}
                      count="(0)"
                      on={false}
                      onClick={() => setCats((cur) => (cur.includes(node.label) ? cur : [...cur, node.label]))}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
              <div className="results__sort-wrap" ref={sortWrapRef}>
                <button
                  type="button"
                  className="btn-outline results__sort"
                  onClick={() => setSortMenuOpen((o) => !o)}
                  aria-expanded={sortMenuOpen}
                  aria-haspopup="listbox"
                  data-testid="sort-dropdown-btn"
                >
                  SORT: {sortLabel}
                </button>
                {sortMenuOpen && (
                  <div className="results__sort-menu" role="listbox" aria-label="Sort" data-testid="sort-dropdown">
                    {SORTS.map((o) => {
                      const on = o.value === sort
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="option"
                          aria-selected={on}
                          className={`results__sort-opt${on ? ' is-on' : ''}`}
                          onClick={() => { setSort(o.value); setSortMenuOpen(false) }}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
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
            END OF THE ARCHIVE · SHOWING {fmt(listings.length)} OF {fmt(PROTO_LISTINGS.length)}
          </div>
        </main>
      </div>

      <div className="dock" data-testid="browse-dock">
        <button type="button" className="dock__btn" onClick={() => setSheetOpen(true)}>
          <FilterIcon />
          FILTERS{depts.length + cats.length > 0 ? ` ${depts.length + cats.length}` : ''}
        </button>
        <button type="button" className="dock__btn">SORT {sortLabel}</button>
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
