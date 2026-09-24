'use client'

/**
 * Seller order view (design "Checkout & Orders"): buyer record, escrow
 * timeline, CONFIRM → PRINT LABEL / MARK SHIPPED actions, payout + protection.
 */
import { useState } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import { autoReleaseAt, SHIPPED_AUTO_DELIVER_DAYS, STATE_LABELS, type OrderState } from '@/lib/orders'
import { Timeline, SummaryPanel, ProtectedPanel, ShipToPanel, countdown, orderNumber, type OrderData, type ListingSnap } from './order-frame'
import { countryName } from '@/lib/countries'
import { normalizeShipTo } from '@/lib/addresses'

interface BuyerStats {
  username: string | null
  purchase_count: number
  dispute_count: number
  member_since: string | null
}

interface Props {
  order: OrderData
  listing: ListingSnap
  buyerStats: BuyerStats | null
  reviewPrompt?: React.ReactNode
}

function memberDuration(since: string | null): string {
  if (!since) return ''
  const months = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24 * 30))
  return months < 1 ? 'NEW' : `${months}MO`
}

export default function OrderSellerView({ order, listing, buyerStats, reviewPrompt }: Props) {
  const [loading, setLoading] = useState(false)
  const [shipLoading, setShipLoading] = useState(false)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [error, setError] = useState<string | null>(null)

  const state = order.state as OrderState
  const releaseDate = order.delivered_at ? autoReleaseAt(new Date(order.delivered_at)) : null
  const sold = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  const buyer = buyerStats?.username ?? 'buyer'
  // International lanes: the seller was paid the shipping and buys their own tracked label.
  const sellerLabel = order.label_mode === 'seller'
  const destCountry = countryName(normalizeShipTo(order.ship_to_address ?? order.shipping_address ?? null)?.country)
  const headline =
    state === 'paid_held' ? 'Sold — confirm to start.'
    : state === 'seller_confirmed' ? 'Ship it.'
    : state === 'shipped' ? 'In transit.'
    : state === 'delivered' ? 'Delivered — payout pending.'
    : state === 'released' ? 'Paid out.'
    : state === 'disputed' ? 'Dispute open.'
    : STATE_LABELS[state]

  async function handleConfirm() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/orders/${order.id}/confirm`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    window.location.reload()
  }

  async function handleShip(e: React.FormEvent) {
    e.preventDefault()
    setShipLoading(true); setError(null)
    const res = await fetch(`/api/orders/${order.id}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier, trackingNumber: tracking }),
    })
    const data = await res.json()
    setShipLoading(false)
    if (!res.ok) { setError(data.error); return }
    window.location.reload()
  }

  return (
    <main className="page-main">
      <div className="crumb"><PrefetchLink href="/orders">ORDERS</PrefetchLink> / {orderNumber(order.id)}</div>
      <div className="page-head page-head--ruled">
        <h1 className="page-title">{headline}</h1>
        <span className="page-note">ORDER {orderNumber(order.id)} · SOLD {sold} · {STATE_LABELS[state]}</span>
      </div>
      <div className="split mt-24">
        <div className="split__main">
          <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">ESCROW TIMELINE</span><span className="page-note">SELLING TO @{buyer.toUpperCase()}</span></div>
          <Timeline order={order} />

          <div className="mt-32" style={{ maxWidth: 440 }}>
            {state === 'paid_held' && (
              <>
                <button type="button" className="btn-primary btn-primary--lg" onClick={handleConfirm} disabled={loading} data-testid="confirm-order">
                  {loading ? 'CONFIRMING…' : 'CONFIRM ORDER →'}
                </button>
                <div className="mono-note" style={{ paddingTop: 10 }}>{sellerLabel ? `CONFIRM, THEN SHIP TO ${destCountry.toUpperCase()} WITH ANY TRACKED CARRIER · SHIP WITHIN 3 DAYS` : 'CONFIRMING UNLOCKS THE PREPAID LABEL · SHIP WITHIN 3 DAYS'}</div>
              </>
            )}
            {state === 'seller_confirmed' && (
              order.shipping_label_url ? (
                <form onSubmit={handleShip}>
                  <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">PREPAID LABEL READY</span></div>
                  <a href={order.shipping_label_url} target="_blank" rel="noopener noreferrer" className="btn-ink" style={{ marginTop: 14 }} data-testid="print-label">PRINT SHIPPING LABEL →</a>
                  <div className="settings-note" style={{ paddingTop: 10 }}>Shipping was paid by the buyer. Print the label, drop it off, then mark shipped.</div>
                  <button type="submit" className="btn-primary" disabled={shipLoading} data-testid="mark-shipped">{shipLoading ? 'SAVING…' : 'MARK AS SHIPPED'}</button>
                </form>
              ) : (
                <form onSubmit={handleShip}>
                  <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">{sellerLabel ? `SHIP TO ${destCountry.toUpperCase()}` : 'MARK AS SHIPPED'}</span></div>
                  {sellerLabel && (
                    <div className="settings-note" style={{ paddingBottom: 6 }} data-testid="seller-label-note">
                      The buyer paid {formatCents(order.shipping_cents)} for shipping, and it&rsquo;s included in your payout. Buy a tracked label with any carrier, include a customs form with the item&rsquo;s value, then enter the tracking number. Carrier scans update this order automatically.
                    </div>
                  )}
                  <div className="field-grid">
                    <div>
                      <label className="field-label" htmlFor="ship-carrier">CARRIER</label>
                      <input id="ship-carrier" className="input-sans" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={sellerLabel ? 'USPS, DHL, FedEx, UPS' : 'USPS, UPS, FedEx'} required />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="ship-tracking">TRACKING NUMBER</label>
                      <input id="ship-tracking" className="input-mono" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" required />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={shipLoading} data-testid="mark-shipped">{shipLoading ? 'SAVING…' : 'MARK AS SHIPPED'}</button>
                </form>
              )
            )}
            {(state === 'delivered' || state === 'released') && (
              <div className="kv"><span className="kv__k">PAYOUT</span><span className="kv__v">{formatCents(order.transfer_cents)}{state === 'delivered' && releaseDate ? ` — AUTO-RELEASES IN ${countdown(releaseDate)}` : ' — RELEASED'}</span></div>
            )}
            {state === 'disputed' && (
              <div className="push-banner" style={{ borderColor: 'var(--alert)' }}>
                <span>The buyer opened a dispute. A moderator reviews both sides; your listing photos are already archived as evidence.</span>
              </div>
            )}
            {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
          </div>
          {reviewPrompt}
        </div>
        <div className="split__side">
          {state !== 'cancelled' && state !== 'refunded' && <ShipToPanel order={order} />}
          <SummaryPanel order={order} listing={listing} role="seller" />
          {buyerStats && (
            <div className="panel">
              <div className="panel__title">BUYER RECORD</div>
              <div className="row" style={{ gap: 10 }}>
                <span className="seller-init seller-init--sm">{buyer.slice(0, 2).toUpperCase()}</span>
                <span className="row-line__handle">@{buyer}</span>
              </div>
              <div className="mono-note" style={{ paddingTop: 8 }}>
                {buyerStats.purchase_count} PURCHASES · {buyerStats.dispute_count} DISPUTES · MEMBER {memberDuration(buyerStats.member_since)}
              </div>
              <div className="save-row save-row--left" style={{ paddingTop: 12 }}>
                <PrefetchLink href={`/messages?listing=${order.listing_id}`} className="link-underline link-underline--ink">MESSAGE BUYER →</PrefetchLink>
              </div>
            </div>
          )}
          <ProtectedPanel lines={[
            `BUYER OR CARRIER SCAN CONFIRMS DELIVERY · AUTOMATIC AFTER ${SHIPPED_AUTO_DELIVER_DAYS} DAYS IN TRANSIT`,
            'YOUR LISTING PHOTOS ARE ARCHIVED AS EVIDENCE',
            'DISPUTES REQUIRE BUYER PHOTOS WITHIN 72H',
          ]} />
        </div>
      </div>
    </main>
  )
}
