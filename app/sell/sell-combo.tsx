'use client'

/**
 * Typeahead field shared by CATEGORY and SIZE on the listing form (sell page redesign A):
 * type, pick a row from the list that overlays the fields below, and the pick's meta
 * (department / category, scale) sits inside the field on the right. `search('')` decides
 * what shows on focus before anything is typed (the whole size scale; nothing for
 * categories). On blur, a query that exactly matches one row is taken as that pick.
 */
import { useId, useRef, useState } from 'react'

export interface ComboOption {
  key: string
  label: string
  meta?: string
}

interface Props {
  id: string
  /** The current pick, shown when the field is idle ('' when none). */
  value: string
  /** Shown inside the field, right-aligned, while idle. */
  valueMeta?: string
  placeholder: string
  listLabel: string
  search: (query: string) => ComboOption[]
  onPick: (key: string) => void
  testId?: string
}

export default function SellCombo({ id, value, valueMeta = '', placeholder, listLabel, search, onPick, testId }: Props) {
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
          className={`sellx-input${idle && valueMeta ? ' sellx-combo__input--picked' : ''}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query ?? value}
          placeholder={placeholder}
          onFocus={(e) => { if (query === null) { setQuery(''); setActive(0); e.currentTarget.select() } }}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onBlur={() => window.setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && open) { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && open) { e.preventDefault(); pick(results[active]) }
            else if (e.key === 'Escape') { setQuery(null); inputRef.current?.blur() }
          }}
          data-testid={testId}
        />
        {idle && valueMeta && <span className="sellx-combo__meta sellx-combo__picked" aria-hidden="true">{valueMeta.toUpperCase()}</span>}
      </div>
      {open && (
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
              <span>{o.label}</span>
              {o.meta && <span className="sellx-combo__meta">{o.meta.toUpperCase()}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
