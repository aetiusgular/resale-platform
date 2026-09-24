'use client'

/**
 * SIZE typeahead (sell page redesign A): same field as CATEGORY (./sell-combo). Focus shows
 * the whole scale for the department + category (lib/sizes sizeScaleFor); typing narrows it,
 * sizes that start with the typed text first. Only sizes on the scale can be picked, so the
 * browse MY SIZES filter keeps matching.
 */
import { sizeScaleFor } from '@/lib/sizes'
import SellCombo, { type ComboOption } from './sell-combo'

interface Props {
  department: string
  category: string
  size: string
  onPick: (size: string) => void
}

export default function SellSize({ department, category, size, onPick }: Props) {
  const scale = sizeScaleFor(department, category)
  const search = (q: string): ComboOption[] => {
    const t = q.trim().toLowerCase()
    const rows = t ? scale.filter((s) => s.toLowerCase().includes(t)) : scale
    return rows
      .slice()
      .sort((a, b) => (t ? Number(!a.toLowerCase().startsWith(t)) - Number(!b.toLowerCase().startsWith(t)) : 0))
      .map((s) => ({ key: s, label: s }))
  }
  return (
    <SellCombo
      id="sell-size"
      value={size}
      placeholder={category ? 'Select' : 'Pick a category first'}
      listLabel="Sizes"
      search={search}
      onPick={onPick}
      testId="sell-size"
    />
  )
}
