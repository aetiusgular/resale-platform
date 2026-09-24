'use client'

/**
 * SHIPPING dropdown on the listing form (sell page redesign A). US shipping is automatic
 * (system-priced, prepaid label) and is not shown. The dropdown lists the regions the seller
 * can price for their ship-from country (lib/shipping-regions): a platform switch row per
 * region with a flat cost. A US seller sees Canada; a seller anywhere else sees North America.
 */
import { useId, useState, type Dispatch, type SetStateAction } from 'react'
import { formatCents } from '@/lib/fees'
import { intlSummary, REGION_LABELS, regionsForOrigin, type IntlShipping, type RegionKey } from '@/lib/shipping-regions'

/** One row's editable state: switch + the typed dollars. */
export type RegionDraft = { on: boolean; raw: string }
export type RegionDrafts = Partial<Record<RegionKey, RegionDraft>>

/** Drafts from stored cents (edit / continue a draft). */
export function regionDraftsFrom(intl: IntlShipping): RegionDrafts {
  const out: RegionDrafts = {}
  for (const [k, v] of Object.entries(intl)) {
    if (typeof v === 'number') out[k as RegionKey] = { on: true, raw: (v / 100).toFixed(v % 100 === 0 ? 0 : 2) }
  }
  return out
}

/** Dollars typed → integer cents, or null when blank / not a number. */
export function dollarsToCents(raw: string): number | null {
  const t = raw.replace(/[^0-9.]/g, '')
  if (!t) return null
  const n = parseFloat(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

/** Switched-on regions that have a price → the intl_shipping payload. */
export function intlFromDrafts(drafts: RegionDrafts, origin: string): IntlShipping {
  const out: IntlShipping = {}
  for (const k of regionsForOrigin(origin)) {
    const d = drafts[k]
    if (!d?.on) continue
    const cents = dollarsToCents(d.raw)
    if (cents !== null) out[k] = cents
  }
  return out
}

/** First switched-on region with no usable price (publish blocks on it). */
export function regionMissingPrice(drafts: RegionDrafts, origin: string): RegionKey | null {
  for (const k of regionsForOrigin(origin)) {
    const d = drafts[k]
    if (d?.on && dollarsToCents(d.raw) === null) return k
  }
  return null
}

interface Props {
  origin: string
  drafts: RegionDrafts
  onChange: Dispatch<SetStateAction<RegionDrafts>>
  defaultOpen?: boolean
}

export default function SellShipping({ origin, drafts, onChange, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const regions = regionsForOrigin(origin)
  const summary = intlSummary(intlFromDrafts(drafts, origin), formatCents, origin)

  const set = (k: RegionKey, patch: Partial<RegionDraft>) => {
    onChange((prev) => ({ ...prev, [k]: { ...(prev[k] ?? { on: false, raw: '' }), ...patch } }))
  }

  return (
    <div className="sellx-ship">
      <button
        type="button"
        className={`sellx-ship__trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-testid="sell-shipping"
      >
        <span>{summary}</span>
        <span className="sellx-ship__caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id={panelId} className="sellx-ship__menu" role="group" aria-label="Shipping regions">
          {regions.map((k) => {
            const d = drafts[k] ?? { on: false, raw: '' }
            const label = REGION_LABELS[k]
            return (
              <div key={k} className="sellx-ship__row" data-testid={`ship-region-${k}`}>
                <span className="sellx-ship__name">{label}</span>
                {d.on && (
                  <label className="sellx-ship__cost">
                    <span aria-hidden="true">$</span>
                    <input
                      inputMode="decimal"
                      value={d.raw}
                      onChange={(e) => set(k, { raw: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="0"
                      aria-label={`${label} shipping cost in USD`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="sellx-ship__toggle"
                  role="switch"
                  aria-checked={d.on}
                  aria-label={`Ship to ${label}`}
                  onClick={() => set(k, { on: !d.on })}
                >
                  <span className="switch-row__state">{d.on ? 'ON' : 'OFF'}</span>
                  <span className={`switch${d.on ? ' is-on' : ''}`}><span className="switch__knob" /></span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
