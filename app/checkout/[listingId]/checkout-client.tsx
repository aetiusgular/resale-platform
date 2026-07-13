'use client'

/**
 * CheckoutClient — mounts Stripe Elements and handles payment submission.
 * On mount, calls POST /api/checkout to create the PaymentIntent + lock the listing.
 * Uses individual CardNumber/Expiry/CVC elements to match the design.
 */
import { useState, useEffect, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useRouter } from 'next/navigation'
import { formatCents } from '@/lib/fees'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Stripe Elements appearance matching design tokens
const ELEMENT_OPTIONS = {
  style: {
    base: {
      fontFamily: '"Space Mono", monospace',
      fontSize: '14px',
      color: 'var(--color-ink)',
      '::placeholder': { color: 'var(--color-ink-soft)' },
    },
    invalid: { color: 'var(--color-alert)' },
  },
}

interface Props {
  listingId: string
  totalCents: number
  savedAddress: Record<string, string> | null
}

function PaymentForm({ listingId, totalCents, savedAddress }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [address, setAddress] = useState({
    fullName:    savedAddress?.fullName    ?? '',
    street:      savedAddress?.street      ?? '',
    apt:         savedAddress?.apt         ?? '',
    city:        savedAddress?.city        ?? '',
    stateZip:    savedAddress?.stateZip    ?? '',
    country:     savedAddress?.country     ?? 'United States',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // On mount: create PaymentIntent + lock listing
  const initCheckout = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, shippingAddress: address }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Listing is no longer available')
        return
      }
      setClientSecret(data.clientSecret)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initCheckout()
  }, [initCheckout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return

    setLoading(true)
    setError(null)

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) { setLoading(false); return }

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardNumber,
          billing_details: { name: address.fullName },
        },
      },
    )

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed')
      setLoading(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      // Poll for the order to be created (webhook may take a moment)
      router.push(`/checkout/success?pi=${paymentIntent.id}`)
    }
  }

  const fieldStyle: React.CSSProperties = {
    position: 'relative',
    height: 44,
    border: '1px solid var(--color-line)',
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    boxSizing: 'border-box',
    fontSize: 14,
    color: 'var(--color-ink)',
    background: 'var(--color-bg)',
  }

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    left: 6,
    top: -8,
    background: 'var(--color-bg)',
    padding: '0 4px',
    font: '500 11px var(--font-ui)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-ink-soft)',
    whiteSpace: 'nowrap',
  }

  const sectionLabel: React.CSSProperties = {
    font: '500 11px var(--font-ui)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-ink-soft)',
    borderBottom: '1px solid var(--color-line)',
    paddingBottom: 12,
  }

  if (error && !clientSecret) {
    return (
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-alert)', marginBottom: 16 }}>
          {error}
        </div>
        <a href="/browse" style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'underline' }}>
          Browse other listings
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Shipping address */}
      <div style={sectionLabel}>Shipping address</div>
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>Full name</span>
          <input
            value={address.fullName}
            onChange={e => setAddress(a => ({ ...a, fullName: e.target.value }))}
            required
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-ink)', width: '100%', fontFamily: 'var(--font-ui)' }}
            placeholder="Full name"
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Street address</span>
          <input
            value={address.street}
            onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
            required
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-ink)', width: '100%', fontFamily: 'var(--font-ui)' }}
            placeholder="Street address"
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Apt, unit — optional</span>
          <input
            value={address.apt}
            onChange={e => setAddress(a => ({ ...a, apt: e.target.value }))}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-ink)', width: '100%', fontFamily: 'var(--font-ui)' }}
            placeholder="Apt, unit — optional"
          />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ ...fieldStyle, flex: 2 }}>
            <span style={labelStyle}>City</span>
            <input
              value={address.city}
              onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
              required
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-ink)', width: '100%', fontFamily: 'var(--font-ui)' }}
              placeholder="City"
            />
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <span style={labelStyle}>State · ZIP</span>
            <input
              value={address.stateZip}
              onChange={e => setAddress(a => ({ ...a, stateZip: e.target.value }))}
              required
              style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-ink)', width: '100%' }}
              placeholder="NY 10001"
            />
          </div>
        </div>
        <div style={{ ...fieldStyle, justifyContent: 'space-between' }}>
          <span style={labelStyle}>Country</span>
          <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>{address.country}</span>
          <span style={{ fontSize: 10, color: 'var(--color-ink-soft)' }}>▾</span>
        </div>
      </div>

      {/* Card section */}
      <div style={{ marginTop: 48, border: '1px solid var(--color-line)', borderRadius: 2 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
          Card
        </div>
        <div style={{ padding: '28px 16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={fieldStyle}>
            <span style={labelStyle}>Card number</span>
            <div style={{ width: '100%' }}>
              <CardNumberElement options={ELEMENT_OPTIONS} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <span style={labelStyle}>Expiry</span>
              <div style={{ width: '100%' }}>
                <CardExpiryElement options={ELEMENT_OPTIONS} />
              </div>
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <span style={labelStyle}>CVC</span>
              <div style={{ width: '100%' }}>
                <CardCvcElement options={ELEMENT_OPTIONS} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-alert)' }}>
          {error}
        </div>
      )}

      {/* Pay button */}
      <div style={{ marginTop: 32 }}>
        <button
          type="submit"
          disabled={loading || !stripe || !clientSecret}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            height: 44,
            width: '100%',
            background: loading ? 'var(--color-ink-soft)' : 'var(--color-ink)',
            color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)',
            borderRadius: 2,
            font: '500 14px var(--font-ui)',
            letterSpacing: '-0.01em',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {clientSecret ? 'Processing…' : 'Loading…'}
            </span>
          ) : (
            <>
              Pay{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
                {formatCents(totalCents)}
              </span>
              {' '}— held in escrow
            </>
          )}
        </button>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center' }}>
          your payment is held until you confirm delivery. seller is paid after.
        </div>
      </div>
    </form>
  )
}

export default function CheckoutClient({ listingId, totalCents, savedAddress }: Props) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        listingId={listingId}
        totalCents={totalCents}
        savedAddress={savedAddress}
      />
    </Elements>
  )
}
