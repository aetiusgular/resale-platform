'use client'

/**
 * "MEASUREMENTS — FLAT" (design 4A): the category's label set with an IN / CM
 * toggle. Unmeasured labels show "—" so the panel keeps its shape.
 */
import { useState } from 'react'
import { formatMeasurement } from '@/lib/taxonomy'

export default function MeasurementsPanel({ labels, values }: { labels: ReadonlyArray<string>; values: Record<string, number> }) {
  const [unit, setUnit] = useState<'in' | 'cm'>('in')
  return (
    <div className="pdp-meas" data-testid="measurements">
      <div className="pdp-meas__head">
        <span className="pdp-meas__title">MEASUREMENTS — FLAT</span>
        <span className="unit-toggle">
          <button type="button" className={unit === 'in' ? 'is-on' : ''} onClick={() => setUnit('in')} aria-pressed={unit === 'in'}>IN</button>
          <button type="button" className={unit === 'cm' ? 'is-on' : ''} onClick={() => setUnit('cm')} aria-pressed={unit === 'cm'}>CM</button>
        </span>
      </div>
      <div className="pdp-meas__grid">
        {labels.map((label) => (
          <div key={label} className="pdp-meas__row">
            <span className="pdp-meas__label">{label}</span>
            <span className="pdp-meas__val">{typeof values[label] === 'number' ? formatMeasurement(values[label], unit) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
