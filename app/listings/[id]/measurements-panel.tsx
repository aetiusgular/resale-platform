'use client'

/**
 * Measurements: the category's label set, an IN / CM toggle and a "?" that opens a
 * one-line note on how they were taken. Unmeasured labels show "—" so the panel
 * keeps its shape.
 *
 * When a listing has NO measurements and the viewer can ask (a signed-in non-seller on
 * an active listing), the grid is replaced by the R5B empty state: a status line and one
 * solid REQUEST MEASUREMENTS button (a real button, not a text link — solid so it reads
 * as the action; see NN/g / CXL on ghost vs solid CTR). The request is structured — the
 * seller is prompted to add the four fields, and the values land back in this same panel.
 * The seller and everyone else still see the normal "—" grid.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { formatMeasurement, measurementDisplayLabel } from '@/lib/taxonomy'
import { useAuthModal } from '@/app/components/auth-modal-provider'

/** The note follows the label set (lib/taxonomy measurementLabelsFor), so it never describes a measurement the panel doesn't list. */
function hintFor(labels: ReadonlyArray<string>): string {
  if (labels.includes('PIT TO PIT')) return 'Laid flat. Pit to pit is straight across the chest; length is collar seam to hem.'
  if (labels.includes('INSEAM')) return 'Laid flat. Waist is straight across the top; inseam is crotch seam to hem.'
  if (labels.includes('INSOLE')) return 'Insole is heel to toe inside the shoe; width is across the widest part of the sole.'
  return 'Taken flat, in a straight line, at the longest and widest points.'
}

export default function MeasurementsPanel({
  labels,
  values,
  listingId,
  canRequest = false,
  guest = false,
  initialRequested = false,
}: {
  labels: ReadonlyArray<string>
  values: Record<string, number>
  listingId?: string
  /** Signed-in non-seller on an active listing: show the request action when measurements are missing. */
  canRequest?: boolean
  /** Signed-out viewer: the request button opens the sign-in popup. */
  guest?: boolean
  /** This viewer already asked (server-loaded). */
  initialRequested?: boolean
}) {
  const [unit, setUnit] = useState<'in' | 'cm'>('in')
  const [hint, setHint] = useState(false)
  const [requested, setRequested] = useState(initialRequested)
  const hintText = hintFor(labels)
  const hasAny = labels.some((label) => typeof values[label] === 'number')
  const showRequest = !hasAny && (canRequest || guest)

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
            onClick={() => setHint((v) => !v)}
          >
            ?
          </button>
        </span>
        {showRequest ? (
          <span className="pdp-meas__status">{requested ? 'REQUESTED · SELLER NOTIFIED' : 'NOT ADDED BY THE SELLER YET'}</span>
        ) : (
          <span className="unit-toggle" role="group" aria-label="Measurement unit">
            <button type="button" className={unit === 'in' ? 'is-on' : ''} onClick={() => setUnit('in')} aria-pressed={unit === 'in'}>IN</button>
            <button type="button" className={unit === 'cm' ? 'is-on' : ''} onClick={() => setUnit('cm')} aria-pressed={unit === 'cm'}>CM</button>
          </span>
        )}
      </div>
      {hint && (
        <p className="pdp-meas__hint" id="meas-hint">
          {hintText}
        </p>
      )}
      {showRequest ? (
        <RequestMeasurements listingId={listingId ?? ''} guest={guest} requested={requested} setRequested={setRequested} labels={labels} />
      ) : (
        <div className="pdp-meas__grid">
          {labels.map((label) => (
            <div key={label} className="pdp-meas__row">
              <span className="pdp-meas__label">{measurementDisplayLabel(label)}</span>
              <span className="pdp-meas__val">{typeof values[label] === 'number' ? formatMeasurement(values[label], unit) : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RequestMeasurements({ listingId, guest, requested, setRequested, labels }: {
  listingId: string
  guest: boolean
  requested: boolean
  setRequested: (v: boolean) => void
  labels: ReadonlyArray<string>
}) {
  const [loading, setLoading] = useState(false)
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()

  async function request() {
    if (guest) { openAuthModal(pathname); return }
    if (requested || loading) return
    setLoading(true)
    const prev = requested
    setRequested(true) // optimistic
    const res = await fetch(`/api/listings/${listingId}/measurement-request`, { method: 'POST' })
    if (!res.ok && res.status !== 409) setRequested(prev)
    setLoading(false)
  }

  return (
    <div className="pdp-meas__request" data-testid="measurements-request">
      <button
        type="button"
        className={requested ? 'btn-ghost pdp-meas__request-btn is-done' : 'btn-primary pdp-meas__request-btn'}
        onClick={request}
        disabled={loading || requested}
        aria-label={requested ? 'Measurements requested' : `Request measurements: ${labels.join(', ')}`}
        data-testid="request-measurements-btn"
      >
        {requested ? 'REQUESTED' : 'REQUEST MEASUREMENTS'}
      </button>
    </div>
  )
}
