'use client'

/**
 * BoostClient — pick a promotion package and pay for it (Fee Model v3).
 * Calls POST /api/boosts for a PaymentIntent, then confirms with Stripe Elements.
 * A boost is a standalone platform charge (no Connect transfer). On success the
 * webhook activates the boost and floats the listing to the top of browse.
 */
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Link from 'next/link'
import { formatCents } from '@/lib/fees'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CARD_OPTIONS = {
  style: { base: { fontFamily: '"Space Mono", monospace', fontSize: '14px', color: 'var(--color-ink)', '::placeholder': { color: 'var(--color-ink-soft)' } }, invalid: { color: 'var(--color-alert)' } },
}

type Pkg = { key: string; label: string; amountCents: number; durationDays: number }

interface Props {
  listingId: string
  title: string
  brand: string
  active: boolean
  boostedUntil: string | null
  packages: Pkg[]
}

function box(selected: boolean) {
  return {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', border: `1px solid ${selected ? 'var(--color-ink)' : 'var(--color-line)'}`,
    borderRadius: 2, cursor: 'pointer', background: selected ? 'var(--color-bg-alt, #f6f4ef)' : 'var(--color-bg)',
  } as const
}

function BoostForm({ listingId, title, brand, active, boostedUntil, packages }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [selected, setSelected] = useState<string>(packages[1]?.key ?? packages[0]?.key ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [nowMs] = useState(() => Date.now())

  const currentlyBoosted = !!boostedUntil && new Date(boostedUntil).getTime() > nowMs
  const pkg = packages.find((p) => p.key === selected) ?? null

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

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ font: '600 22px var(--font-ui)', color: 'var(--color-ink)' }}>Boost activated</h1>
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginTop: 8 }}>
          {title.toUpperCase()} is now promoted to the top of browse for {pkg?.durationDays} days.
        </p>
        <Link href={`/listings/${listingId}`} style={{ display: 'inline-block', marginTop: 24, height: 44, lineHeight: '44px', padding: '0 24px', background: 'var(--color-ink)', color: 'var(--color-bg)', textDecoration: 'none', borderRadius: 2, font: '500 14px var(--font-ui)' }}>
          View listing
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: '0 24px' }}>
      <h1 style={{ font: '600 22px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Boost this listing</h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 4 }}>
        {title.toUpperCase()} · {brand.toUpperCase()}
      </p>

      {!active && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-alert)' }}>
          Only active listings can be boosted. This listing isn&apos;t active right now.
        </p>
      )}
      {currentlyBoosted && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-ink-soft)' }}>
          Already boosted until {new Date(boostedUntil as string).toLocaleDateString()}. Buying another extends promotion.
        </p>
      )}

      <form onSubmit={handlePay} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {packages.map((p) => (
          <label key={p.key} style={box(selected === p.key)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" name="pkg" value={p.key} checked={selected === p.key} onChange={() => setSelected(p.key)} />
              <span style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)' }}>{p.label}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-ink)' }}>{formatCents(p.amountCents)}</span>
          </label>
        ))}

        <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--color-line)', borderRadius: 2 }}>
          <CardElement options={CARD_OPTIONS} />
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--color-alert)' }}>{error}</p>}

        <button
          type="submit"
          disabled={!stripe || loading || !active || !pkg}
          style={{ marginTop: 8, height: 48, background: 'var(--color-ink)', color: 'var(--color-bg)', border: 'none', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: loading || !active ? 'not-allowed' : 'pointer', opacity: loading || !active ? 0.6 : 1 }}
        >
          {loading ? 'Processing…' : pkg ? `Pay ${formatCents(pkg.amountCents)} — boost ${pkg.durationDays} days` : 'Select a package'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--color-ink-soft)', textAlign: 'center' }}>
          Promoted listings are labelled and capped per page. Charged once; no auto-renewal.
        </p>
      </form>
    </div>
  )
}

export default function BoostClient(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <BoostForm {...props} />
    </Elements>
  )
}
