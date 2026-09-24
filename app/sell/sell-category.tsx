'use client'

/**
 * CATEGORY typeahead (sell page redesign A): type "cargo" or "boots", pick a row that reads
 * "Casual pants · MENSWEAR / BOTTOMS". Every department × category × subcategory in
 * lib/taxonomy is one option; the pick sets department, category and subcategory together.
 * The field itself is ./sell-combo, shared with SIZE.
 */
import { CATEGORY_TREE, DEPARTMENTS } from '@/lib/taxonomy'
import SellCombo, { type ComboOption } from './sell-combo'

type Option = ComboOption & { dept: string; category: string; sub: string; haystack: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const keyOf = (dept: string, category: string, sub: string) => [dept, category, sub].join('|')

const OPTIONS: Option[] = DEPARTMENTS.flatMap((dept) =>
  CATEGORY_TREE.flatMap((node) => [
    { dept, category: node.label, sub: '', label: `All ${node.label.toLowerCase()}`, meta: `${cap(dept)} / ${node.label}` },
    ...node.children.map((sub) => ({ dept, category: node.label, sub, label: sub, meta: `${cap(dept)} / ${node.label}` })),
  ]).map((o) => ({ ...o, key: keyOf(o.dept, o.category, o.sub), haystack: `${o.sub} ${o.category} ${o.dept}`.toLowerCase() })),
)

/** Nothing before the seller types; then every option that has all the words, subcategory-name hits first. */
function search(q: string): Option[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return OPTIONS.filter((o) => terms.every((t) => o.haystack.includes(t)))
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
  return (
    <SellCombo
      id="sell-category"
      value={category ? (subcategory || `All ${category.toLowerCase()}`) : ''}
      valueMeta={category ? `${cap(department)} / ${category}` : ''}
      placeholder="Search categories"
      listLabel="Categories"
      search={search}
      onPick={(key) => { const [d, c, s] = key.split('|'); onPick(d, c, s) }}
      testId="sell-category"
    />
  )
}
