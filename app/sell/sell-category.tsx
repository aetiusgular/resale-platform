'use client'

/**
 * CATEGORY typeahead (sell page redesign A): type "cargo" or "boots", pick a row that reads
 * "Casual pants · MENSWEAR / BOTTOMS". Every department × category × subcategory in
 * lib/taxonomy is one option; the pick sets department, category and subcategory together.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { CATEGORY_TREE, DEPARTMENTS } from '@/lib/taxonomy'

type Option = { dept: string; category: string; sub: string; label: string; meta: string; haystack: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const OPTIONS: Option[] = DEPARTMENTS.flatMap((dept) =>
  CATEGORY_TREE.flatMap((node) => [
    { dept, category: node.label, sub: '', label: `All ${node.label.toLowerCase()}`, meta: `${cap(dept)} / ${node.label}` },
    ...node.children.map((sub) => ({ dept, category: node.label, sub, label: sub, meta: `${cap(dept)} / ${node.label}` })),
  ]).map((o) => ({ ...o, haystack: `${o.sub} ${o.category} ${o.dept}`.toLowerCase() })),
)

function search(q: string): Option[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return OPTIONS.filter((o) => terms.every((t) => o.haystack.includes(t)))
    // Subcategory-name hits first, then department order.
    .sort((a, b) => Number(!a.sub.toLowerCase().startsWith(terms[0])) - Number(!b.sub.toLowerCase().startsWith(terms[0])))
    .slice(0, 8)
}

interface Props {
  department: string
  category: string
  subcategory: string
  onPick: (dept: string, category: string, sub: string) => void
}

export default function SellCategory({ department, category, subcategory, onPick }: Props) {
  const listId = useId()
  const current = category ? (subcategory || `All ${category.toLowerCase()}`) : ''
  const currentMeta = category ? `${cap(department)} / ${category}` : ''
  const [query, setQuery] = useState<string | null>(null) // null = showing the current pick
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => (query ? search(query) : []), [query])
  const open = query !== null && results.length > 0

  const pick = (o: Option) => {
    onPick(o.dept, o.category, o.sub)
    setQuery(null)
    setActive(0)
  }

  return (
    <div className={`sellx-combo${open ? ' is-open' : ''}`}>
      <div className="sellx-combo__field">
        <input
          ref={inputRef}
          id="sell-category"
          className={`sellx-input${query === null && currentMeta ? ' sellx-combo__input--picked' : ''}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query ?? current}
          placeholder="Search categories"
          onFocus={(e) => { if (query === null) { setQuery(''); e.currentTarget.select() } }}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onBlur={() => window.setTimeout(() => setQuery(null), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && open) { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && open) { e.preventDefault(); pick(results[active]) }
            else if (e.key === 'Escape') { setQuery(null); inputRef.current?.blur() }
          }}
          data-testid="sell-category"
        />
        {query === null && currentMeta && <span className="sellx-combo__meta sellx-combo__picked" aria-hidden="true">{currentMeta.toUpperCase()}</span>}
      </div>
      {open && (
        <ul id={listId} className="sellx-combo__list" role="listbox" aria-label="Categories">
          {results.map((o, i) => (
            <li
              key={`${o.dept}|${o.category}|${o.sub}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`sellx-combo__opt${i === active ? ' is-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.label}</span>
              <span className="sellx-combo__meta">{o.meta.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
