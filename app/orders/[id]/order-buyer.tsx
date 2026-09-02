'use client'

/**
 * Buyer order status view.
 * Shows timeline, auto-release countdown, CONFIRM RECEIPT button, REPORT AN ISSUE link.
 * Matches design reference 1c (Checkout & Orders.dc.html).
 */
import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/fees'
import { STATE_LABELS, autoReleaseAt, isDisputeWindowOpen, type OrderState } from '@/lib/orders'

interface OrderData {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  state: string
  item_cents: number
  buyer_fee_cents: number
  seller_fee_cents: number
  shipping_cents: number
  total_cents: number
  transfer_cents: number
  carrier: string | null
  tracking_number: string | null
  paid_at: string | null
  seller_confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  released_at: string | null
  disputed_at: string | null
  refunded_at: string | null
  cancelled_at: string | null
  created_at: string
}

interface Props {
  order: OrderData
  listing: { title: string; brand: string; size: string; images: string[] }
  sellerUsername: string
  reviewPrompt?: React.ReactNode
}

const TIMELINE_STATES: OrderState[] = [
  'paid_held', 'seller_confirmed', 'shipped', 'delivered', 'released',
]

function formatTs(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function countdown(to: Date): string {
  const ms = to.getTime() - Date.now()
  if (ms <= 0) return '0H'
  const days  = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? `${days}D ${hours}H` : `${hours}H`
}

export default function OrderBuyerView({ order, listing, sellerUsername, reviewPrompt }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  const orderNum = order.id.slice(0, 5).toUpperCase()
  const placedDate = new Date(order.created_at).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const image = listing.images?.find(Boolean) ?? null
  const currentState = order.state as OrderState
  const isTerminal = ['released', 'refunded', 'cancelled'].includes(currentState)
  const isDelivered = currentState === 'delivered'
  const releaseDate = order.delivered_at ? autoReleaseAt(new Date(order.delivered_at)) : null
  const canDispute  = isDelivered && order.delivered_at ? isDisputeWindowOpen(new Date(order.delivered_at)) : false

  const stateTs: Partial<Record<OrderState, string | null>> = {
    paid_held:        order.paid_at,
    seller_confirmed: order.seller_confirmed_at,
    shipped:          order.shipped_at,
    delivered:        order.delivered_at,
    released:         order.released_at,
  }

  // Which states have been reached?
  const reached = TIMELINE_STATES.indexOf(currentState)

  async function confirmReceipt() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/orders/${order.id}/deliver`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setDone(true)
    window.location.reload()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{ height: 64, borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px' }}>
        <span style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>archive</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
          ORDER NO. {orderNum} · PLACED {placedDate.toUpperCase()}
        </span>
        <Link href="/orders" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>
          All orders
        </Link>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 96px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 64, alignItems: 'start' }}>
        {/* Timeline */}
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>
            Order status
          </h1>

          {reviewPrompt}

          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column' }}>
            {TIMELINE_STATES.map((state, i) => {
              const ts = stateTs[state]
              const isDone    = reached > i || (reached === i && !['delivered'].includes(currentState) && !isTerminal)
              const isCurrent = reached === i && !isTerminal
              const isPending = reached < i

              let dotStyle: React.CSSProperties
              if (isDone || (isCurrent && currentState !== 'delivered')) {
                dotStyle = {
                  width: 18, height: 18, boxSizing: 'border-box',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 2, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, color: 'var(--color-accent)',
                }
              } else if (isCurrent && currentState === 'delivered') {
                dotStyle = {
                  width: 18, height: 18, borderRadius: 2,
                  background: 'var(--color-accent)',
                  animation: 'pvPulse 2s ease-in-out infinite',
                }
              } else {
                dotStyle = {
                  width: 18, height: 18, boxSizing: 'border-box',
                  border: '1px solid var(--color-line)', borderRadius: 2, display: 'block',
                }
              }

              return (
                <div key={state} style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={dotStyle}>{(isDone || (isCurrent && currentState !== 'delivered')) && '✓'}</span>
                    {i < TIMELINE_STATES.length - 1 && (
                      <span style={{ width: 1, flex: 1, background: 'var(--color-line)', margin: '4px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < TIMELINE_STATES.length - 1 ? 36 : 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', color: isPending ? 'var(--color-ink-soft)' : 'var(--color-ink)' }}>
                      {STATE_LABELS[state]}
                      {state === 'shipped' && order.tracking_number && (
                        <> · <span style={{ fontWeight: 400 }}>TRACKING {order.tracking_number}</span></>
                      )}
                    </div>
                    <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}>
                      {ts ? formatTs(ts) : (isPending ? 'PENDING' : '')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions — only shown when delivered */}
          {isDelivered && !done && (
            <div style={{ marginTop: 48, maxWidth: 400 }}>
              <button
                onClick={confirmReceipt}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  whiteSpace: 'nowrap', height: 44, width: '100%',
                  background: 'var(--color-ink)', color: 'var(--color-bg)',
                  border: '1px solid var(--color-ink)', borderRadius: 2,
                  font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Confirming…' : 'Confirm receipt — release funds'}
              </button>
              {releaseDate && (
                <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', textAlign: 'center' }}>
                  OR FUNDS RELEASE AUTOMATICALLY IN {countdown(releaseDate)}
                </div>
              )}
              {canDispute && (
                <div style={{ marginTop: 32, textAlign: 'center' }}>
                  <Link href={`/orders/${order.id}/dispute`} style={{ font: '500 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)', textDecoration: 'none' }}>
                    Report an issue
                  </Link>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-ink-soft)' }}>
                    requires photos within 72h of delivery · pauses the auto-release
                  </div>
                </div>
              )}
              {error && <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-alert)' }}>{error}</div>}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Order summary */}
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Order</div>
            <div style={{ padding: 16, display: 'flex', gap: 16 }}>
              {image ? (
                <img src={image} alt={listing.title} style={{ flex: 'none', width: 64, aspectRatio: '3/4', objectFit: 'cover', border: '1px solid var(--color-line)' }} />
              ) : (
                <div style={{ flex: 'none', width: 64, aspectRatio: '3/4', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-ink-soft)' }}>3 : 4</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, lineHeight: 1.4, color: 'var(--color-ink)' }}>{listing.title.toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 4 }}>{listing.brand.toUpperCase()} · {listing.size.toUpperCase()}</div>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)' }}><span>PRICE</span><span>{formatCents(order.item_cents)}</span></div>
              {order.buyer_fee_cents > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}><span>BUYER FEE</span><span>{formatCents(order.buyer_fee_cents)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}><span>SHIPPING</span><span>{formatCents(order.shipping_cents)}</span></div>
              <div style={{ borderTop: '1px solid var(--color-line)', marginTop: 3, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)' }}><span>TOTAL</span><span>{formatCents(order.total_cents)}</span></div>
            </div>
          </div>

          {/* Seller info */}
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)' }}>@{sellerUsername}</div>
            <Link href={`/messages/${order.seller_id}`} style={{ alignSelf: 'flex-start', font: '500 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)', textDecoration: 'none', marginTop: 4 }}>
              Message seller
            </Link>
          </div>
        </div>
      </div>

      <style>{`@keyframes pvPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}
