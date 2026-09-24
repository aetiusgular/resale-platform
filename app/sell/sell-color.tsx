'use client'

/**
 * COLOR typeahead (sell page redesign A): the same field as CATEGORY and SIZE (./sell-combo)
 * over the platform colour set (lib/taxonomy COLORS — the browse rail's list, stored on
 * listings.color as the label). Focus lists every colour with its swatch in rail order;
 * typing narrows them through `searchColors` (labels first, then the words people actually
 * use — "gray", "ivory", "off-white", "khaki", "oxblood"), and a row found through such an
 * alias prints it on the right so the suggestion explains itself. Only a listed colour can
 * be picked.
 */
import { COLORS, colorMatchHint, searchColors } from '@/lib/taxonomy'
import SellCombo, { type ComboOption } from './sell-combo'

interface Props {
  color: string
  onPick: (color: string) => void
}

export default function SellColor({ color, onPick }: Props) {
  const picked = COLORS.find((c) => c.label === color)

  const search = (q: string): ComboOption[] =>
    searchColors(q).map((c) => ({ key: c.label, label: c.label, swatch: c.swatch, meta: colorMatchHint(c, q) ?? undefined }))

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
