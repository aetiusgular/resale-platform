'use client'

/**
 * SIZE typeahead (sell page redesign A): same field as CATEGORY (./sell-combo). It searches
 * every MY SIZES section of the listing's department (lib/sizes sizeOptionsFor): tops,
 * bottoms, outerwear, footwear, tailoring, accessories. Focus lists them all, the category's
 * own section first; typing narrows them, sizes that start with the typed text first. Each
 * row names its section ("34 · BOTTOMS", "34S · TAILORING", "M · TOPS · OUTERWEAR"). Only
 * sizes on a scale can be picked, so the browse MY SIZES filter keeps matching.
 */
import { useMemo } from 'react'
import { sizeOptionsFor } from '@/lib/sizes'
import SellCombo, { type ComboOption } from './sell-combo'

interface Props {
  department: string
  category: string
  size: string
  onPick: (size: string) => void
}

export default function SellSize({ department, category, size, onPick }: Props) {
  const rows = useMemo<ComboOption[]>(
    () => sizeOptionsFor(department, category).map((o) => ({ key: o.label, label: o.label, meta: o.sections.join(' · ') })),
    [department, category],
  )
  const picked = rows.find((r) => r.label === size)

  const search = (q: string): ComboOption[] => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows
      .filter((r) => r.label.toLowerCase().includes(t))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)))
  }

  return (
    <SellCombo
      id="sell-size"
      value={size}
      valueMeta={picked?.meta ?? ''}
      placeholder="Select"
      listLabel="Sizes"
      search={search}
      onPick={onPick}
      testId="sell-size"
    />
  )
}
