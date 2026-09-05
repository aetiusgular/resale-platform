'use client'

/**
 * BoostClient — pick a promotion package and pay for it (Fee Model v3).
 * Calls POST /api/boosts for a PaymentIntent, then confirms with Stripe Elements.
 * A boost is a standalone platform charge (no Connect transfer). On success the
 * webhook activates the boost and floats the listing to the top of browse.
 *
 * Layout follows the settings/checkout pattern: ruled page head, numbered
 * section heads, option cells for the packages, a Stripe card field, and a
 * side panel that restates what a boost does next to the free bump.
 */
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import { BUMP_COOLDOWN_DAYS, PRICE_DROP_BUMP_MIN_PCT } from '@/lib/bump/eligibility'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CARD_OPTIONS = {
  style: {
    base: {
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace',
      fontSize: '13px',
      fontWeight: '300',
      '::placeholder': { color: '#9d9d98' },
    },
  },
}

type Pkg = { key: string; label: string; amountCents: number; durationDays: number }

/** Free-bump state computed server-side (null = bump off or listing not active). */
type FreeBump = { availableNow: boolean; nextAtIso: string | null }

interface Props {
  listingId: string
  title: string
  brand: string
  active: boolean
  boostedUntil: string | null
  packages: Pkg[]
  freeBump: FreeBump | null
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

function BoostForm({ listingId, title, brand, active, boostedUntil, packages, freeBump }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [selected, setSelected] = useState<string>(packages[1]?.key ?? packages[0]?.key ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [nowMs] = useState(() => Date.now())

  const currentlyBoosted = !!boostedUntil && new Date(boostedUntil).getTime() > nowMs
  const pkg = packages.find((p) => p.key === selected) ?? null
  const perDay = (p: Pkg) => Math.round(p.amountCents / p.durationDays)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !pkg) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/boosts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, package: pkg.key }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not start boost'); setLoading(false); return }
      const card = elements.getElement(CardElement)
      if (!card) { setError('Card element not ready'); setLoading(false); return }
      const result = await stripe.confirmCardPayment(data.clientSecret, { payment_method: { card } })
      if (result.error) { setError(result.error.message ?? 'Payment failed'); setLoading(false); return }
      setDone(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const side = (
    <div className="split__side">
      <div className="panel">
        <div className="panel__title">THIS LISTING</div>
        <div className="row-line__handle" style={{ fontWeight: 300 }}>{title}</div>
        <div className="mono-note" style={{ paddingTop: 6 }}>{brand.toUpperCase()}{currentlyBoosted && boostedUntil ? ` · PROMOTED UNTIL ${shortDate(boostedUntil)}` : ''}</div>
      </div>
      <div className="panel">
        <div className="panel__title">WHAT A BOOST DOES</div>
        <div className="kv"><span className="kv__k">01</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>PINNED TO THE TOP OF BROWSE FOR THE WHOLE PERIOD</span></div>
        <div className="kv"><span className="kv__k">02</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>LABELLED PROMOTED · CAPPED PER PAGE</span></div>
        <div className="kv"><span className="kv__k">03</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>CHARGED ONCE · NO AUTO-RENEWAL</span></div>
      </div>
      {freeBump && (
        <div className="panel">
          <div className="panel__title">THE FREE ALTERNATIVE</div>
          <p className="settings-note" style={{ margin: 0 }}>
            {freeBump.availableNow ? (
              <>
                A free bump is available now — one refresh to the top of browse every {BUMP_COOLDOWN_DAYS} days. It lifts the listing once; a boost keeps it pinned.
              </>
            ) : (
              <>
                Your free bump (one refresh every {BUMP_COOLDOWN_DAYS} days) is next available {freeBump.nextAtIso ? shortDate(freeBump.nextAtIso) : 'soon'}, or drop the price {PRICE_DROP_BUMP_MIN_PCT}% to bump early.
              </>
            )}
          </p>
          {freeBump.availableNow && (
            <div className="save-row save-row--left" style={{ paddingTop: 12 }}>
              <PrefetchLink href={`/listings/${listingId}`} className="link-underline link-underline--ink">BUMP FOR FREE INSTEAD →</PrefetchLink>
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (done) {
    return (
      <div className="split">
        <div className="split__main">
          <div className="empty" style={{ textAlign: 'left', padding: '24px 0' }}>
            <div className="empty__title">Boost activated.</div>
            <div className="empty__sub">{title.toUpperCase()} IS PROMOTED AT THE TOP OF BROWSE FOR {pkg?.durationDays} DAYS</div>
            <div className="empty__cta">
              <PrefetchLink href={`/listings/${listingId}`} className="btn-primary btn-primary--inline" data-testid="boost-view-listing">VIEW LISTING →</PrefetchLink>
            </div>
          </div>
        </div>
        {side}
      </div>
    )
  }

  return (
    <form onSubmit={handlePay} className="split">
      <div className="split__main">
        {!active && (
          <div className="push-banner" style={{ marginTop: 0, marginBottom: 20, borderColor: 'var(--alert)' }}>
            <span>Only active listings can be boosted. This one isn&rsquo;t active right now.</span>
          </div>
        )}
        {currentlyBoosted && boostedUntil && (
          <div className="push-banner" style={{ marginTop: 0, marginBottom: 20 }}>
            <span>Already promoted until {new Date(boostedUntil).toLocaleDateString()}. Buying another package extends the promotion.</span>
          </div>
        )}

        <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">01 — PACKAGE</span><span className="page-note">PICK ONE</span></div>
        <div className="option-grid" role="radiogroup" aria-label="Boost package" data-testid="boost-packages">
          {packages.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={selected === p.key}
              className={`option-cell${selected === p.key ? ' is-on' : ''}`}
              onClick={() => setSelected(p.key)}
              data-testid={`boost-pkg-${p.key}`}
            >
              <span className="option-cell__t">{p.label}</span>
              <span className="option-cell__s">{formatCents(p.amountCents)} · {p.durationDays} DAYS · {formatCents(perDay(p))}/DAY</span>
            </button>
          ))}
        </div>

        <div className="sec-head"><span className="sec-head__label">02 — CARD</span><span className="page-note">HANDLED BY STRIPE · NEVER STORED HERE</span></div>
        <div className="field-block">
          <div className="field-label">CARD</div>
          <div className="stripe-field"><CardElement options={CARD_OPTIONS} /></div>
        </div>

        {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}

        <div className="save-row save-row--left" style={{ paddingTop: 28 }}>
          <button
            type="submit"
            className="btn-primary btn-primary--inline"
            disabled={!stripe || loading || !active || !pkg}
            data-testid="boost-pay"
          >
            {loading ? 'PROCESSING…' : pkg ? `PAY ${formatCents(pkg.amountCents)} — BOOST ${pkg.durationDays} DAYS` : 'SELECT A PACKAGE'}
          </button>
          <span className="page-note">CHARGED ONCE · NO AUTO-RENEWAL</span>
        </div>
      </div>
      {side}
    </form>
  )
}

export default function BoostClient(props: Props) {
  return (
    <main className="page-main">
      <div className="crumb"><PrefetchLink href="/sell">SELL</PrefetchLink> / <PrefetchLink href={`/listings/${props.listingId}`}>LISTING</PrefetchLink> / BOOST</div>
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Boost this listing.</h1>
        <span className="page-note">PROMOTED · TOP OF BROWSE</span>
      </div>
      <div className="mt-24">
        <Elements stripe={stripePromise}>
          <BoostForm {...props} />
        </Elements>
      </div>
    </main>
  )
}
