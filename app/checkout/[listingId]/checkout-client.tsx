'use client'

/**
 * CheckoutClient — design "Checkout": order summary + escrow explainer on the
 * side, shipping address + card on the main column. Mounts Stripe Elements and
 * handles payment submission. On mount, calls POST /api/checkout to create the
 * PaymentIntent + lock the listing; the response's orderSummary (server-computed,
 * offer-aware) is what the totals display.
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
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Stripe Elements appearance matching design tokens (mono data fields)
const ELEMENT_OPTIONS = {
  style: {
    base: {
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace',
      fontSize: '13px',
      fontWeight: '300',
      '::placeholder': { color: '#9d9d98' },
    },
  },
}

type Amounts = { item_cents: number; shipping_cents: number; total_cents: number; buyer_fee_cents?: number; discount_cents?: number }

interface Props {
  listingId: string
  offerId: string | null
  listing: { title: string; brand: string; size: string; image: string | null }
  preview: Amounts
  savedAddress: Record<string, string> | null
}

function PaymentForm({ listingId, offerId, listing, preview, savedAddress }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [address, setAddress] = useState({
    fullName: savedAddress?.fullName ?? savedAddress?.name ?? '',
    street: savedAddress?.street ?? savedAddress?.street1 ?? '',
    apt: savedAddress?.apt ?? savedAddress?.street2 ?? '',
    city: savedAddress?.city ?? '',
    stateZip: savedAddress?.stateZip ?? [savedAddress?.state, savedAddress?.zip].filter(Boolean).join(' '),
    country: savedAddress?.country ?? 'United States',
  })
  const [error, setError] = useState<string | null>(null)
  // `loading` starts true: the PaymentIntent is created on mount (below) and the
  // flag flips off in that request's finally — no synchronous setState in the effect.
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Amounts>(preview)

  // On mount: create PaymentIntent + lock listing. Promise chain (not async/await)
  // so every state update happens inside a resolved callback.
  const initCheckout = useCallback(() => {
    return fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ...(offerId ? { offerId } : {}), shippingAddress: address }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? 'Listing is no longer available')
          return
        }
        setClientSecret(data.clientSecret)
        if (data.orderSummary) {
          setAmounts({
            item_cents: data.orderSummary.item_cents,
            shipping_cents: data.orderSummary.shipping_cents,
            total_cents: data.orderSummary.total_cents,
            buyer_fee_cents: data.orderSummary.buyer_fee_cents,
            discount_cents: data.orderSummary.discount_cents,
          })
        }
      })
      .catch(() => setError('Network error — please try again'))
      .finally(() => setLoading(false))
  }, [listingId, offerId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const field = (k: keyof typeof address) => ({
    value: address[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [k]: e.target.value })),
  })

  const summary = (
    <div className="split__side">
      <div className="panel">
        <div className="panel__title">{offerId ? 'YOUR ORDER — ACCEPTED OFFER' : 'YOUR ORDER'}</div>
        <div className="review-item" style={{ marginTop: 0, border: 'none', padding: 0 }}>
          <span className="review-item__thumb" style={{ background: 'var(--tone-2)', overflow: 'hidden' }}>
            {listing.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </span>
          <div className="review-item__main">
            <div className="review-item__row"><span className="review-item__brand">{listing.brand.toUpperCase()}</span></div>
            <div className="review-item__title" style={{ whiteSpace: 'normal' }}>{listing.title}</div>
            <div className="review-item__meta">SIZE {listing.size.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ paddingTop: 12 }}>
          <div className="kv"><span className="kv__k">ITEM</span><span className="kv__v">{formatCents(amounts.item_cents)}</span></div>
          <div className="kv"><span className="kv__k">BUYER FEE</span><span className="kv__v kv__v--dim">{amounts.buyer_fee_cents ? formatCents(amounts.buyer_fee_cents) : 'NONE'}</span></div>
          <div className="kv"><span className="kv__k">SHIPPING</span><span className="kv__v">{amounts.shipping_cents ? formatCents(amounts.shipping_cents) : 'INCLUDED'}</span></div>
          {!!amounts.discount_cents && amounts.discount_cents > 0 && (
            <div className="kv"><span className="kv__k">REWARD</span><span className="kv__v">−{formatCents(amounts.discount_cents)}</span></div>
          )}
          <div className="kv kv--total"><span className="kv__k">TOTAL</span><span className="kv__v" data-testid="checkout-total">{formatCents(amounts.total_cents)}</span></div>
        </div>
        {!clientSecret && !error && <div className="mono-note" style={{ paddingTop: 10 }}>CONFIRMING PRICE WITH THE SERVER…</div>}
      </div>
      <div className="panel">
        <div className="panel__title">ESCROW</div>
        <div className="kv"><span className="kv__k">01</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>YOUR PAYMENT IS HELD, NOT SENT TO THE SELLER</span></div>
        <div className="kv"><span className="kv__k">02</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>SELLER SHIPS ON A PREPAID, TRACKED LABEL</span></div>
        <div className="kv"><span className="kv__k">03</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>FUNDS RELEASE WHEN YOU CONFIRM DELIVERY, OR 3 DAYS AFTER</span></div>
      </div>
    </div>
  )

  if (error && !clientSecret) {
    return (
      <div className="split">
        <div className="split__main">
          <div className="empty" style={{ textAlign: 'left', padding: '24px 0' }}>
            <div className="empty__title">Checkout couldn&rsquo;t start.</div>
            <div className="alert-line">{error.toUpperCase()}</div>
            <div className="empty__cta"><PrefetchLink href="/browse" className="btn-ghost btn-ghost--inline">BROWSE OTHER LISTINGS →</PrefetchLink></div>
          </div>
        </div>
        {summary}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="split">
      <div className="split__main">
        <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">01 — SHIPPING ADDRESS</span><span className="page-note">US ONLY</span></div>
        <div className="field-block">
          <label className="field-label" htmlFor="co-name">FULL NAME</label>
          <input id="co-name" className="input-sans" required placeholder="Name on the label" autoComplete="name" {...field('fullName')} />
        </div>
        <div className="field-grid field-grid--2-1">
          <div>
            <label className="field-label" htmlFor="co-street">STREET ADDRESS</label>
            <input id="co-street" className="input-sans" required placeholder="Street and number" autoComplete="address-line1" {...field('street')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-apt">APT / UNIT</label>
            <input id="co-apt" className="input-sans" placeholder="Optional" autoComplete="address-line2" {...field('apt')} />
          </div>
        </div>
        <div className="field-grid field-grid--2-1-1">
          <div>
            <label className="field-label" htmlFor="co-city">CITY</label>
            <input id="co-city" className="input-sans" required autoComplete="address-level2" {...field('city')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-statezip">STATE · ZIP</label>
            <input id="co-statezip" className="input-mono" required placeholder="NY 10001" {...field('stateZip')} />
          </div>
          <div>
            <div className="field-label">COUNTRY</div>
            <div className="select-row" style={{ cursor: 'default' }}>{address.country}<span className="select-row__caret">US</span></div>
          </div>
        </div>

        <div className="sec-head"><span className="sec-head__label">02 — CARD</span><span className="page-note">HANDLED BY STRIPE · NEVER STORED HERE</span></div>
        <div className="field-block">
          <div className="field-label">CARD NUMBER</div>
          <div className="stripe-field"><CardNumberElement options={ELEMENT_OPTIONS} /></div>
        </div>
        <div className="field-grid">
          <div>
            <div className="field-label">EXPIRY</div>
            <div className="stripe-field"><CardExpiryElement options={ELEMENT_OPTIONS} /></div>
          </div>
          <div>
            <div className="field-label">CVC</div>
            <div className="stripe-field"><CardCvcElement options={ELEMENT_OPTIONS} /></div>
          </div>
        </div>

        {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}

        <div className="save-row save-row--left" style={{ paddingTop: 28 }}>
          <button type="submit" className="btn-primary btn-primary--inline" disabled={loading || !stripe || !clientSecret} data-testid="pay-button">
            {loading ? (clientSecret ? 'PROCESSING…' : 'LOADING…') : `PAY ${formatCents(amounts.total_cents)} — HELD IN ESCROW`}
          </button>
          <span className="page-note">RELEASED TO THE SELLER ONLY AFTER YOU CONFIRM DELIVERY</span>
        </div>
      </div>
      {summary}
    </form>
  )
}

export default function CheckoutClient(props: Props) {
  return (
    <main className="page-main">
      <div className="crumb"><PrefetchLink href={`/listings/${props.listingId}`}>← BACK TO LISTING</PrefetchLink></div>
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Checkout</h1>
        <span className="page-note">EVERY SALE IN ESCROW · NO BUYER FEE</span>
      </div>
      <div className="mt-24">
        <Elements stripe={stripePromise}>
          <PaymentForm {...props} />
        </Elements>
      </div>
    </main>
  )
}
