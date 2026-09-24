'use client'

/**
 * Typeahead field shared by CATEGORY, SIZE and COLOR on the listing form (sell page redesign
 * A): type, pick a row from the list that overlays the fields below, and the pick's meta
 * (department / category, scale) sits inside the field on the right; a row's `swatch`
 * (colours) draws the browse rail's dot before its label and, once picked, in the field
 * (`valueSwatch`). `search('')` decides
 * what shows on focus before anything is typed (the whole size scale; nothing for
 * categories). On blur, a query that exactly matches one row is taken as that pick.
 * `layout: 'grid'` lays the rows out as size cells (the MY SIZES modal's .size-grid /
 * .size-cell), `cols` wide; arrows move across and down the grid.
 */
import { useId, useRef, useState } from 'react'

export interface ComboOption {
  key: string
  label: string
  meta?: string
  /** CSS background for a colour dot before the label (list layout). */
  swatch?: string
}

interface Props {
  id: string
  /** The current pick, shown when the field is idle ('' when none). */
  value: string
  /** Shown inside the field, right-aligned, while idle. */
  valueMeta?: string
  /** The pick's colour dot, shown inside the field on the right while idle. */
  valueSwatch?: string
  placeholder: string
  listLabel: string
  search: (query: string) => ComboOption[]
  onPick: (key: string) => void
  testId?: string
  /** 'list' (default): one row per option with its meta. 'grid': size cells, `cols` wide. */
  layout?: 'list' | 'grid'
  cols?: number
}

export default function SellCombo({ id, value, valueMeta = '', valueSwatch = '', placeholder, listLabel, search, onPick, testId, layout = 'list', cols = 5 }: Props) {
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null) // null = idle, showing the current pick
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = query === null ? [] : search(query)
  const open = query !== null && results.length > 0
  const idle = query === null

  const pick = (o: ComboOption) => {
    onPick(o.key)
    setQuery(null)
    setActive(0)
  }

  const close = () => {
    // A typed value that names exactly one row is that row (Tab or a click elsewhere).
    if (query !== null) {
      const q = query.trim().toLowerCase()
      const exact = q ? results.filter((r) => r.label.toLowerCase() === q) : []
      if (exact.length === 1) { pick(exact[0]); return }
    }
    setQuery(null)
    setActive(0)
  }

  return (
    <div className={`sellx-combo${open ? ' is-open' : ''}`}>
      <div className="sellx-combo__field">
        <input
          ref={inputRef}
          id={id}
          className="sellx-combo__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query ?? value}
          placeholder={placeholder}
          onFocus={(e) => {
            if (query !== null) return
            // Open on the current pick when it is in the list, so the highlighted row is what is set.
            const rows = search('')
            const at = rows.findIndex((r) => r.key === value || r.label === value)
            setQuery(''); setActive(at >= 0 ? at : 0); e.currentTarget.select()
          }}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onBlur={() => window.setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (!open) { if (e.key === 'Escape') { setQuery(null); inputRef.current?.blur() }; return }
            const step = (d: number) => { e.preventDefault(); setActive((i) => Math.max(0, Math.min(results.length - 1, i + d))) }
            const grid = layout === 'grid'
            if (e.key === 'ArrowDown') step(grid ? cols : 1)
            else if (e.key === 'ArrowUp') step(grid ? -cols : -1)
            else if (e.key === 'ArrowRight' && grid && e.currentTarget.selectionStart === e.currentTarget.value.length) step(1)
            else if (e.key === 'ArrowLeft' && grid && e.currentTarget.selectionEnd === 0) step(-1)
            else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]) }
            else if (e.key === 'Escape') { setQuery(null); inputRef.current?.blur() }
          }}
          data-testid={testId}
        />
        {idle && valueMeta && <span className="sellx-combo__meta sellx-combo__picked" aria-hidden="true">{valueMeta.toUpperCase()}</span>}
        {idle && valueSwatch && <span className="swatch sellx-combo__picked" style={{ background: valueSwatch }} aria-hidden="true" />}
      </div>
      {open && layout === 'grid' && (
        <ul id={listId} className="sellx-combo__list sellx-combo__list--grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="listbox" aria-label={listLabel}>
          {results.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`size-cell${i === active ? ' is-on' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setActive(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {open && layout === 'list' && (
        <ul id={listId} className="sellx-combo__list" role="listbox" aria-label={listLabel}>
          {results.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`sellx-combo__opt${i === active ? ' is-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="sellx-combo__label">
                {o.swatch && <span className="swatch" style={{ background: o.swatch }} aria-hidden="true" />}
                {o.label}
              </span>
              {o.meta && <span className="sellx-combo__meta">{o.meta.toUpperCase()}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
