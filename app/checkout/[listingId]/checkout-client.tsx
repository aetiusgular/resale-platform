'use client'

/**
 * CheckoutClient — design "Checkout": order summary + escrow explainer on the
 * side, shipping address + card on the main column. Mounts Stripe Elements and
 * handles payment submission. On mount, calls POST /api/checkout to create the
 * PaymentIntent + lock the listing; the response's orderSummary (server-computed,
 * offer-aware) is what the totals display.
 *
 * International shipping: the shipping line depends on the destination country
 * (lib/shipping-regions). The mount POST prices the buyer's saved address; whenever the typed
 * address differs, PATCH /api/checkout re-prices and re-snapshots it before the card is
 * charged, and a changed total needs a second press of PAY. A lane the seller
 * doesn't ship to keeps the form open with the reason instead of a dead end.
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
import { cleanAddress, postalFieldLabel, regionFieldLabel, regionRequired, type AddressInput } from '@/lib/addresses'
import { COUNTRY_OPTIONS, countryName, isRestrictedCountry } from '@/lib/countries'

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

type Amounts = {
  item_cents: number
  shipping_cents: number
  total_cents: number
  buyer_fee_cents?: number
  discount_cents?: number
  label_mode?: 'platform' | 'seller'
  shipping_label?: string
}

type AddressForm = { name: string; street1: string; street2: string; city: string; state: string; zip: string; country: string }

type OrderSummary = {
  item_cents: number
  shipping_cents: number
  total_cents: number
  buyer_fee_cents?: number
  discount_cents?: number
  label_mode?: 'platform' | 'seller'
  shipping_label?: string
}

const toAmounts = (s: OrderSummary): Amounts => ({
  item_cents: s.item_cents,
  shipping_cents: s.shipping_cents,
  total_cents: s.total_cents,
  buyer_fee_cents: s.buyer_fee_cents,
  discount_cents: s.discount_cents,
  label_mode: s.label_mode,
  shipping_label: s.shipping_label,
})

/** Prefill from profiles.shipping_address (address-book shape, or the legacy free-text keys). */
function addressFormFrom(saved: Record<string, string> | null): AddressForm {
  const s = saved ?? {}
  const legacyStateZip = (s.stateZip ?? '').trim().split(/\s+/)
  return {
    name: s.name ?? s.fullName ?? '',
    street1: s.street1 ?? s.street ?? '',
    street2: s.street2 ?? s.apt ?? '',
    city: s.city ?? '',
    state: s.state ?? (legacyStateZip.length === 2 ? legacyStateZip[0] : ''),
    zip: s.zip ?? (legacyStateZip.length === 2 ? legacyStateZip[1] : ''),
    country: s.country || 'US',
  }
}

/** Stable key for "is the typed address the one already saved as default?" (null = nothing valid saved). */
function addressKey(a: Record<string, string> | AddressInput | null): string | null {
  if (!a) return null
  const cleaned = cleanAddress(a)
  if ('error' in cleaned) return null
  const c = cleaned.address
  return [c.name, c.street1, c.street2 ?? '', c.city, c.state, c.zip, c.country].map((v) => v.trim().toLowerCase()).join('|')
}

interface Props {
  listingId: string
  offerId: string | null
  listing: { title: string; brand: string; size: string; image: string | null }
  preview: Amounts
  savedAddress: Record<string, string> | null
  shipping: { ships_from: string; us_domestic: boolean; regions: Array<{ key: string; label: string; cents: number }> }
}

function PaymentForm({ listingId, offerId, listing, preview, savedAddress, shipping }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  // Same shape as the address book (lib/addresses AddressInput). profiles.shipping_address
  // is the mirrored default address; the legacy free-text keys are read for old rows only.
  const [address, setAddress] = useState<AddressForm>(() => addressFormFrom(savedAddress))
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => addressKey(savedAddress))
  const [error, setError] = useState<string | null>(null)
  /** A lane the seller doesn't offer: the form stays usable so the buyer can change address. */
  const [shipError, setShipError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // `loading` starts true: the PaymentIntent is created on mount (below) and the
  // flag flips off in that request's finally — no synchronous setState in the effect.
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Amounts>(preview)
  /**
   * The address the server last priced AND snapshotted on the checkout session (the order ships
   * there). Mount prices the saved default; null when there is none, so the first PAY always
   * sends the typed address.
   */
  const [pricedKey, setPricedKey] = useState<string | null>(() => addressKey(savedAddress))

  // On mount: create PaymentIntent + lock listing for the saved address. Promise chain (not
  // async/await) so every state update happens inside a resolved callback.
  const initCheckout = useCallback(() => {
    return fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ...(offerId ? { offerId } : {}) }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          if (data.code === 'shipping_unavailable') setShipError(data.error)
          else setError(data.error ?? 'Listing is no longer available')
          return
        }
        setClientSecret(data.clientSecret)
        if (data.orderSummary) setAmounts(toAmounts(data.orderSummary))
      })
      .catch(() => setError('Network error — please try again'))
      .finally(() => setLoading(false))
  }, [listingId, offerId])

  useEffect(() => {
    initCheckout()
  }, [initCheckout])

  /**
   * Make sure the server priced shipping for this address. Returns true when the card can be
   * charged now; false when it stopped to show a new total or an error.
   */
  async function ensurePriced(addr: AddressInput): Promise<boolean> {
    const before = amounts.total_cents
    if (!clientSecret) {
      // Mount pricing failed (e.g. the saved address is in a region this seller skips):
      // start checkout for the typed address instead.
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, address: addr, ...(offerId ? { offerId } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'shipping_unavailable') setShipError(data.error)
        else setError(data.error ?? 'Checkout couldn’t start')
        return false
      }
      setShipError(null)
      setClientSecret(data.clientSecret)
      setAmounts(toAmounts(data.orderSummary))
      setPricedKey(addressKey(addr))
      setNotice(`Shipping priced for ${countryName(addr.country)}. Check the total, then press pay.`)
      return false
    }
    // Any change of address (not only country) re-snapshots the destination on the session.
    if (addressKey(addr) === pricedKey) return true
    const res = await fetch('/api/checkout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, address: addr }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (data.code === 'shipping_unavailable') setShipError(data.error)
      else setError(data.error ?? 'Could not update shipping')
      return false
    }
    setShipError(null)
    setAmounts(toAmounts(data.orderSummary))
    setPricedKey(addressKey(addr))
    if (data.orderSummary.total_cents !== before) {
      setNotice(`Shipping to ${countryName(addr.country)} is ${formatCents(data.orderSummary.shipping_cents)}. Check the new total, then press pay.`)
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)
    setNotice(null)

    // The order snapshots the priced destination (checkout_sessions.ship_to_address) and the
    // address book keeps it as the default, so the typed address must be SAVED before the
    // card is charged. Validate with the same rules as the address book. Any failure stops
    // the payment: never charge a card for an order the seller cannot ship.
    const cleaned = cleanAddress(address)
    if ('error' in cleaned) { setError(cleaned.error); setLoading(false); return }
    if (addressKey(cleaned.address) !== savedSnapshot) {
      try {
        const res = await fetch('/api/settings/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: cleaned.address, is_default: true }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? 'Could not save your shipping address')
          setLoading(false)
          return
        }
        setSavedSnapshot(addressKey(cleaned.address))
      } catch {
        setError('Network error while saving your address, please try again')
        setLoading(false)
        return
      }
    }

    let ready = false
    try {
      ready = await ensurePriced(cleaned.address)
    } catch {
      setError('Network error while pricing shipping, please try again')
    }
    if (!ready || !clientSecret) { setLoading(false); return }

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) { setLoading(false); return }

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardNumber,
          billing_details: { name: cleaned.address.name },
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

  const field = (k: keyof AddressForm) => ({
    value: address[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [k]: e.target.value })),
  })

  const country = address.country || 'US'
  const needsRegion = regionRequired(country)
  const sellerLabel = amounts.label_mode === 'seller'
  const shipsFromAbroad = !shipping.us_domestic

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
          <div className="kv">
            <span className="kv__k">SHIPPING{amounts.shipping_label ? ` · ${amounts.shipping_label}` : ''}</span>
            <span className="kv__v" data-testid="checkout-shipping">{amounts.shipping_cents ? formatCents(amounts.shipping_cents) : sellerLabel ? 'FREE' : 'INCLUDED'}</span>
          </div>
          {!!amounts.discount_cents && amounts.discount_cents > 0 && (
            <div className="kv"><span className="kv__k">REWARD</span><span className="kv__v">−{formatCents(amounts.discount_cents)}</span></div>
          )}
          <div className="kv kv--total"><span className="kv__k">TOTAL</span><span className="kv__v" data-testid="checkout-total">{formatCents(amounts.total_cents)}</span></div>
        </div>
        {!clientSecret && !error && !shipError && <div className="mono-note" style={{ paddingTop: 10 }}>CONFIRMING PRICE WITH THE SERVER…</div>}
        {(shipsFromAbroad || sellerLabel) && (
          <div className="mono-note" style={{ paddingTop: 10 }}>
            {shipsFromAbroad ? `SHIPS FROM ${countryName(shipping.ships_from).toUpperCase()}. ` : ''}
            {sellerLabel ? 'INTERNATIONAL: DUTIES AND IMPORT TAXES MAY BE DUE ON DELIVERY.' : ''}
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel__title">ESCROW</div>
        <div className="kv"><span className="kv__k">01</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>YOUR PAYMENT IS HELD, NOT SENT TO THE SELLER</span></div>
        <div className="kv"><span className="kv__k">02</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>{sellerLabel ? 'SELLER SHIPS WITH TRACKING' : 'SELLER SHIPS ON A PREPAID, TRACKED LABEL'}</span></div>
        <div className="kv"><span className="kv__k">03</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>FUNDS RELEASE WHEN YOU CONFIRM DELIVERY, OR 3 DAYS AFTER</span></div>
      </div>
    </div>
  )

  if (error && !clientSecret && !shipError) {
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
        <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">01 — SHIPPING ADDRESS</span><span className="page-note">SAVED TO YOUR ADDRESS BOOK</span></div>
        <div className="field-block">
          <label className="field-label" htmlFor="co-country">COUNTRY</label>
          <span className="select-wrap">
            <select
              id="co-country"
              className="select-row"
              value={country}
              onChange={(e) => { const v = e.target.value; setAddress((a) => ({ ...a, country: v })); setShipError(null) }}
              autoComplete="country"
              data-testid="co-country"
            >
              {COUNTRY_OPTIONS.filter((c) => !isRestrictedCountry(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <span className="select-row__caret select-wrap__caret">▾</span>
          </span>
        </div>
        <div className="field-block">
          <label className="field-label" htmlFor="co-name">FULL NAME</label>
          <input id="co-name" className="input-sans" required placeholder="Name on the label" autoComplete="name" data-testid="co-name" {...field('name')} />
        </div>
        <div className="field-grid field-grid--2-1">
          <div>
            <label className="field-label" htmlFor="co-street">STREET ADDRESS</label>
            <input id="co-street" className="input-sans" required placeholder="Street and number" autoComplete="address-line1" data-testid="co-street1" {...field('street1')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-apt">APT / UNIT</label>
            <input id="co-apt" className="input-sans" placeholder="Optional" autoComplete="address-line2" {...field('street2')} />
          </div>
        </div>
        <div className="field-grid field-grid--2-1-1">
          <div>
            <label className="field-label" htmlFor="co-city">CITY</label>
            <input id="co-city" className="input-sans" required autoComplete="address-level2" data-testid="co-city" {...field('city')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-state">{regionFieldLabel(country)}{needsRegion ? '' : ' · OPTIONAL'}</label>
            <input id="co-state" className="input-mono" required={needsRegion} placeholder={country === 'US' ? 'NY' : country === 'CA' ? 'ON' : ''} maxLength={country === 'US' || country === 'CA' ? 2 : 50} autoComplete="address-level1" style={{ textTransform: 'uppercase' }} data-testid="co-state" {...field('state')} />
          </div>
          <div>
            <label className="field-label" htmlFor="co-zip">{postalFieldLabel(country)}</label>
            <input id="co-zip" className="input-mono" required={country === 'US' || country === 'CA' || country === 'GB' || country === 'AU'} placeholder={country === 'US' ? '10001' : ''} inputMode={country === 'US' || country === 'AU' ? 'numeric' : 'text'} autoComplete="postal-code" data-testid="co-zip" {...field('zip')} />
          </div>
        </div>
        {shipError && <div className="alert-line" role="alert" data-testid="ship-error">{shipError.toUpperCase()}</div>}
        {shipping.regions.length > 0 && (
          <div className="mono-note" style={{ paddingTop: 10 }}>
            {shipping.us_domestic ? 'US SHIPPING IS CALCULATED · ' : ''}ALSO SHIPS TO {shipping.regions.map((r) => `${r.label.toUpperCase()} ${r.cents ? formatCents(r.cents) : 'FREE'}`).join(' · ')}
          </div>
        )}

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

        {notice && <div className="mono-note mono-note--ink" role="status" style={{ paddingTop: 16 }}>{notice.toUpperCase()}</div>}
        {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}

        <div className="save-row save-row--left" style={{ paddingTop: 28 }}>
          <button type="submit" className="btn-primary btn-primary--inline" disabled={loading || !stripe} data-testid="pay-button">
            {loading ? (clientSecret ? 'PROCESSING…' : 'LOADING…') : clientSecret ? `PAY ${formatCents(amounts.total_cents)} — HELD IN ESCROW` : 'PRICE SHIPPING →'}
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
