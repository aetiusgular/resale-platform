'use client'

/**
 * COLOR typeahead (sell page redesign A): the same field as CATEGORY and SIZE (./sell-combo)
 * over the platform colour set (lib/taxonomy COLORS — the browse rail's list, stored on
 * listings.color as the label). Focus lists every colour with its swatch; typing narrows
 * them, colours that start with the typed text first. Only a listed colour can be picked.
 */
import { COLORS } from '@/lib/taxonomy'
import SellCombo, { type ComboOption } from './sell-combo'

const ROWS: ComboOption[] = COLORS.map((c) => ({ key: c.label, label: c.label, swatch: c.swatch }))

interface Props {
  color: string
  onPick: (color: string) => void
}

export default function SellColor({ color, onPick }: Props) {
  const picked = ROWS.find((r) => r.label === color)

  const search = (q: string): ComboOption[] => {
    const t = q.trim().toLowerCase()
    if (!t) return ROWS
    return ROWS
      .filter((r) => r.label.toLowerCase().includes(t))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)))
  }

  return (
    <SellCombo
      id="sell-color"
      value={color}
      valueSwatch={picked?.swatch ?? ''}
      placeholder="Select"
      listLabel="Colors"
      search={search}
      onPick={onPick}
      testId="sell-color"
    />
  )
}
