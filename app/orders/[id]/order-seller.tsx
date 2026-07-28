'use client'

/**
 * Seller order status / sale view.
 * Shows buyer record, timeline, payout details, PROTECTED card.
 * Matches design reference 1d (Checkout & Orders.dc.html).
 */
import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/fees'
import { STATE_LABELS, autoReleaseAt, type OrderState } from '@/lib/orders'

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
  cancelled_at: string | null
  created_at: string
}

interface BuyerStats {
  username: string | null
  purchase_count: number
  dispute_count: number
  member_since: string | null
}

interface Props {
  order: OrderData
  listing: { title: string; brand: string; size: string; images: string[] }
  buyerStats: BuyerStats | null
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

function memberDuration(since: string | null): string {
  if (!since) return ''
  const months = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24 * 30))
  return months < 1 ? 'NEW' : `${months}MO`
}

function countdown(to: Date): string {
  const ms = to.getTime() - Date.now()
  if (ms <= 0) return '0H'
  const days  = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? `${days}D ${hours}H` : `${hours}H`
}

export default function OrderSellerView({ order, listing, buyerStats }: Props) {
  const [loading, setLoading] = useState(false)
  const [shipLoading, setShipLoading] = useState(false)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [error, setError] = useState<string | null>(null)

  const orderNum = order.id.slice(0, 5).toUpperCase()
  const soldDate = new Date(order.created_at).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const image = listing.images?.find(Boolean) ?? null
  const currentState = order.state as OrderState
  const isTerminal = ['released', 'refunded', 'cancelled'].includes(currentState)
  const reached = TIMELINE_STATES.indexOf(currentState)
  const releaseDate = order.delivered_at ? autoReleaseAt(new Date(order.delivered_at)) : null

  const stateTs: Partial<Record<OrderState, string | null>> = {
    paid_held:        order.paid_at,
    seller_confirmed: order.seller_confirmed_at,
    shipped:          order.shipped_at,
    delivered:        order.delivered_at,
    released:         order.released_at,
  }

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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{ height: 64, borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px' }}>
        <span style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
          SALE NO. {orderNum} · SOLD {soldDate.toUpperCase()}
        </span>
        <Link href="/orders" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>
          All sales
        </Link>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 24px 96px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 64, alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', margin: 0 }}>
            Sale status
          </h1>

          {/* Buyer record */}
          {buyerStats && (
            <div style={{ marginTop: 28, border: '1px solid var(--color-line)', borderRadius: 2, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', flex: 'none' }}>Buyer</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)' }}>@{buyerStats.username}</span>
              <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
                {buyerStats.purchase_count} PURCHASES · {buyerStats.dispute_count} DISPUTES · MEMBER {memberDuration(buyerStats.member_since)}
              </span>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column' }}>
            {TIMELINE_STATES.map((state, i) => {
              const ts = stateTs[state]
              const isDone    = reached > i
              const isCurrent = reached === i && !isTerminal
              const isPending = reached < i

              let dotStyle: React.CSSProperties
              if (isDone) {
                dotStyle = { width: 18, height: 18, boxSizing: 'border-box', border: '1px solid var(--color-accent)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--color-accent)' }
              } else if (isCurrent && state === 'delivered') {
                dotStyle = { width: 18, height: 18, borderRadius: 2, background: 'var(--color-accent)', animation: 'pvPulse 2s ease-in-out infinite' }
              } else if (isCurrent) {
                dotStyle = { width: 18, height: 18, boxSizing: 'border-box', border: '1px solid var(--color-accent)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--color-accent)' }
              } else {
                dotStyle = { width: 18, height: 18, boxSizing: 'border-box', border: '1px solid var(--color-line)', borderRadius: 2, display: 'block' }
              }

              return (
                <div key={state} style={{ display: 'flex', gap: 20 }}>
                  <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={dotStyle}>{isDone && '✓'}</span>
                    {i < TIMELINE_STATES.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--color-line)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: i < TIMELINE_STATES.length - 1 ? 36 : 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', color: isPending ? 'var(--color-ink-soft)' : 'var(--color-ink)' }}>
                      {STATE_LABELS[state]}
                      {state === 'shipped' && order.tracking_number && <> · <span style={{ fontWeight: 400 }}>TRACKING {order.tracking_number}</span></>}
                    </div>
                    <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}>
                      {ts ? formatTs(ts) : (isPending ? 'PENDING' : '')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Seller actions */}
          <div style={{ marginTop: 48, maxWidth: 440 }}>
            {/* Confirm action */}
            {currentState === 'paid_held' && (
              <>
                <button onClick={handleConfirm} disabled={loading} style={{ height: 44, width: '100%', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Confirming…' : 'Confirm order'}
                </button>
              </>
            )}

            {/* Ship action */}
            {currentState === 'seller_confirmed' && (
              <form onSubmit={handleShip} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', borderBottom: '1px solid var(--color-line)', paddingBottom: 8 }}>
                  Mark as shipped
                </div>
                <input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="Carrier (e.g. USPS)" required style={{ height: 44, border: '1px solid var(--color-line)', borderRadius: 2, padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }} />
                <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number" required style={{ height: 44, border: '1px solid var(--color-line)', borderRadius: 2, padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }} />
                <button type="submit" disabled={shipLoading} style={{ height: 44, background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: shipLoading ? 'not-allowed' : 'pointer' }}>
                  {shipLoading ? 'Saving…' : 'Mark as shipped'}
                </button>
              </form>
            )}

            {/* Payout info + PROTECTED card (delivered/released) */}
            {(currentState === 'delivered' || currentState === 'released') && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)' }}>
                  PAYOUT {formatCents(order.transfer_cents)}
                  {currentState === 'delivered' && releaseDate && ` — AUTO-RELEASES IN ${countdown(releaseDate)}`}
                  {currentState === 'released' && ' — RELEASED'}
                </div>
                <div style={{ marginTop: 20, border: '1px solid var(--color-line)', borderRadius: 2 }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Protected</div>
                  {[
                    'carrier scan confirms delivery',
                    'your listing photos are archived as evidence',
                    'disputes require buyer photos within 72h',
                  ].map((text, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--color-line)' : undefined }}>
                      <span style={{ color: 'var(--color-accent)', fontSize: 12, flex: 'none' }}>✓</span>
                      <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-ink)' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-alert)' }}>{error}</div>}
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Order/payout card */}
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Order</div>
            <div style={{ padding: 16, display: 'flex', gap: 16 }}>
              {image ? <img src={image} alt={listing.title} style={{ flex: 'none', width: 64, aspectRatio: '3/4', objectFit: 'cover', border: '1px solid var(--color-line)' }} /> : <div style={{ flex: 'none', width: 64, aspectRatio: '3/4', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-ink-soft)' }}>3 : 4</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, lineHeight: 1.4, color: 'var(--color-ink)' }}>{listing.title.toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)', marginTop: 4 }}>{listing.brand.toUpperCase()} · {listing.size.toUpperCase()}</div>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink)' }}><span>SOLD FOR</span><span>{formatCents(order.item_cents)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}><span>SELLER FEE</span><span>−{formatCents(order.seller_fee_cents)}</span></div>
              <div style={{ borderTop: '1px solid var(--color-line)', marginTop: 3, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)' }}><span>PAYOUT</span><span>{formatCents(order.transfer_cents)}</span></div>
            </div>
          </div>

          {/* Buyer mini-card */}
          {buyerStats && (
            <div style={{ border: '1px solid var(--color-line)', borderRadius: 2, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--color-ink)' }}>@{buyerStats.username}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)' }}>
                {buyerStats.purchase_count} PURCHASES · {buyerStats.dispute_count} DISPUTES
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pvPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}
