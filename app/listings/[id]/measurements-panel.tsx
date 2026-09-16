'use client'

/**
 * Measurements: category labels, IN / CM toggle, laid-flat hint.
 * Unmeasured labels show "—" so the panel keeps its shape.
 */
import { useState } from 'react'
import { formatMeasurement } from '@/lib/taxonomy'

export default function MeasurementsPanel({ labels, values }: { labels: ReadonlyArray<string>; values: Record<string, number> }) {
  const [unit, setUnit] = useState<'in' | 'cm'>('in')
  const [hint, setHint] = useState(false)
  return (
    <div className="pdp-meas" data-testid="measurements">
      <div className="pdp-meas__head">
        <span className="pdp-meas__title">
          Measurements
          <button
            type="button"
            className={`pdp-meas__q${hint ? ' is-open' : ''}`}
            aria-label="How measurements are taken"
            aria-expanded={hint}
            aria-controls={hint ? 'meas-hint' : undefined}
            title="Laid flat. Chest is pit to pit; length is collar to hem."
            onClick={() => setHint((v) => !v)}
          >
            ?
          </button>
        </span>
        <span className="unit-toggle" role="group" aria-label="Measurement unit">
          <button type="button" className={unit === 'in' ? 'is-on' : ''} onClick={() => setUnit('in')} aria-pressed={unit === 'in'}>IN</button>
          <button type="button" className={unit === 'cm' ? 'is-on' : ''} onClick={() => setUnit('cm')} aria-pressed={unit === 'cm'}>CM</button>
        </span>
      </div>
      {hint && (
        <p className="pdp-meas__hint" id="meas-hint">
          Laid flat. Chest is pit to pit; length is collar to hem.
        </p>
      )}
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
