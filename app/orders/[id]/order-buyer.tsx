'use client'

/**
 * Buyer order view (design "Checkout & Orders"): escrow timeline, auto-release
 * countdown, CONFIRM DELIVERY, REPORT AN ISSUE, order summary + seller panel.
 */
import { useState } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import { autoReleaseAt, isDisputeWindowOpen, STATE_LABELS, type OrderState } from '@/lib/orders'
import { Timeline, SummaryPanel, ProtectedPanel, countdown, orderNumber, type OrderData, type ListingSnap } from './order-frame'

interface Props {
  order: OrderData
  listing: ListingSnap
  sellerUsername: string
  reviewPrompt?: React.ReactNode
}

export default function OrderBuyerView({ order, listing, sellerUsername, reviewPrompt }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const state = order.state as OrderState
  const isDelivered = state === 'delivered'
  const releaseDate = order.delivered_at ? autoReleaseAt(new Date(order.delivered_at)) : null
  const canDispute = isDelivered && order.delivered_at ? isDisputeWindowOpen(new Date(order.delivered_at)) : false
  const placed = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  const headline =
    state === 'released' ? 'Delivered and released.'
    : state === 'delivered' ? 'Delivered — confirm to release.'
    : state === 'shipped' ? 'On its way.'
    : state === 'disputed' ? 'Dispute open.'
    : state === 'refunded' ? 'Refunded.'
    : state === 'cancelled' ? 'Cancelled.'
    : 'Paid and held in escrow.'

  async function confirmReceipt() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/orders/${order.id}/deliver`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    window.location.reload()
  }

  return (
    <main className="page-main">
      <div className="crumb"><PrefetchLink href="/orders">ORDERS</PrefetchLink> / {orderNumber(order.id)}</div>
      <div className="page-head page-head--ruled">
        <h1 className="page-title">{headline}</h1>
        <span className="page-note">ORDER {orderNumber(order.id)} · PLACED {placed} · {STATE_LABELS[state]}</span>
      </div>
      <div className="split mt-24">
        <div className="split__main">
          <div className="sec-head" style={{ marginTop: 0 }}><span className="sec-head__label">ESCROW TIMELINE</span><span className="page-note">BUYING FROM @{sellerUsername.toUpperCase()}</span></div>
          <Timeline order={order} />

          {isDelivered && (
            <div className="mt-32" style={{ maxWidth: 440 }}>
              <button type="button" className="btn-primary btn-primary--lg" onClick={confirmReceipt} disabled={loading} data-testid="confirm-receipt">
                {loading ? 'CONFIRMING…' : 'CONFIRM DELIVERY — RELEASE FUNDS'}
              </button>
              {releaseDate && <div className="mono-note" style={{ paddingTop: 10 }}>OR FUNDS RELEASE AUTOMATICALLY IN {countdown(releaseDate)}</div>}
              {canDispute && (
                <div className="save-row save-row--left" style={{ paddingTop: 22 }}>
                  <PrefetchLink href={`/orders/${order.id}/dispute`} className="btn-ghost btn-ghost--inline">REPORT AN ISSUE</PrefetchLink>
                  <span className="page-note">PHOTOS REQUIRED · WITHIN 72H OF DELIVERY · PAUSES AUTO-RELEASE</span>
                </div>
              )}
              {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
            </div>
          )}
          {state === 'shipped' && order.tracking_number && (
            <div className="kv mt-24"><span className="kv__k">TRACKING</span><span className="kv__v">{order.carrier ? `${order.carrier.toUpperCase()} · ` : ''}{order.tracking_number}</span></div>
          )}
          {state === 'disputed' && (
            <div className="push-banner" style={{ borderColor: 'var(--alert)' }}>
              <span>A moderator is reviewing both sides. Escrow holds until it resolves — you&rsquo;ll hear back by message.</span>
            </div>
          )}
          {reviewPrompt}
        </div>
        <div className="split__side">
          <SummaryPanel order={order} listing={listing} role="buyer" />
          <div className="panel">
            <div className="panel__title">SELLER</div>
            <div className="row" style={{ gap: 10 }}>
              <span className="seller-init seller-init--sm">{sellerUsername.slice(0, 2).toUpperCase()}</span>
              <span className="row-line__handle">@{sellerUsername}</span>
            </div>
            <div className="save-row save-row--left" style={{ paddingTop: 12 }}>
              <PrefetchLink href={`/messages?listing=${order.listing_id}`} className="link-underline link-underline--ink">MESSAGE SELLER →</PrefetchLink>
              <PrefetchLink href={`/sellers/${sellerUsername}`} className="link-underline">PROFILE</PrefetchLink>
            </div>
          </div>
          <ProtectedPanel lines={[
            `${formatCents(order.total_cents)} IS HELD UNTIL YOU CONFIRM DELIVERY`,
            'AUTO-RELEASE 3 DAYS AFTER TRACKED DELIVERY',
            'OPEN A DISPUTE WITHIN 72H — MODERATORS REVIEW BOTH SIDES',
          ]} />
        </div>
      </div>
    </main>
  )
}
