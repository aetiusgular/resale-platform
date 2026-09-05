'use client'

/**
 * Buyer order view (design "Checkout & Orders"): escrow timeline, auto-release
 * countdown, CONFIRM DELIVERY, REPORT AN ISSUE, order summary + seller panel.
 */
import { useState } from 'react'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import {
  autoDeliverAt, autoReleaseAt, buyerOrderAction, isDisputeWindowOpen,
  AUTO_RELEASE_DAYS, STATE_LABELS, type OrderState,
} from '@/lib/orders'
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
  const action = buyerOrderAction(state)
  const isDelivered = state === 'delivered'
  const releaseDate = order.delivered_at ? autoReleaseAt(new Date(order.delivered_at)) : null
  // Manual-shipping fallback: with no carrier scan, `shipped` auto-moves to `delivered`
  // after SHIPPED_AUTO_DELIVER_DAYS (pg_cron), unless the buyer marks it received first.
  const autoDeliverDate = state === 'shipped' && order.shipped_at ? autoDeliverAt(new Date(order.shipped_at)) : null
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

  // shipped → delivered only (starts the 3-day clock + dispute window; releases nothing).
  async function markReceived() {
    await post('receive')
  }

  // delivered → released: funds move to the seller now.
  async function confirmReceipt() {
    await post('deliver')
  }

  async function post(route: 'receive' | 'deliver') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/${route}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); setLoading(false); return }
      window.location.reload()
    } catch {
      setError('Network error, please try again')
      setLoading(false)
    }
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

          {action === 'receive' && (
            <div className="mt-32" style={{ maxWidth: 440 }}>
              <button type="button" className="btn-primary btn-primary--lg" onClick={markReceived} disabled={loading} data-testid="mark-received">
                {loading ? 'SAVING…' : 'MARK AS RECEIVED'}
              </button>
              <div className="mono-note" style={{ paddingTop: 10 }}>
                STARTS THE {AUTO_RELEASE_DAYS}-DAY RELEASE WINDOW · REPORT AN ISSUE OR RELEASE EARLY ONCE RECEIVED
                {autoDeliverDate && <> · MARKED DELIVERED AUTOMATICALLY IN {countdown(autoDeliverDate)}</>}
              </div>
              {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
            </div>
          )}
          {action === 'confirm' && (
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
            `AUTO-RELEASE ${AUTO_RELEASE_DAYS} DAYS AFTER DELIVERY IS CONFIRMED (BY YOU OR THE CARRIER)`,
            'OPEN A DISPUTE WITHIN 72H — MODERATORS REVIEW BOTH SIDES',
          ]} />
        </div>
      </div>
    </main>
  )
}
