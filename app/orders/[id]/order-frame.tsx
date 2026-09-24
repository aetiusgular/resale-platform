'use client'

/**
 * Shared pieces of the order detail page (buyer + seller views): escrow
 * timeline, order summary panel, counterparty panel, protection panel.
 */
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import { addressLines, normalizeShipTo, isShippable, type ShipToAddress } from '@/lib/addresses'
import { STATE_LABELS, type OrderState } from '@/lib/orders'

export interface OrderData {
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
  shipping_label_url?: string | null
  paid_at: string | null
  seller_confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  released_at: string | null
  disputed_at: string | null
  refunded_at?: string | null
  cancelled_at: string | null
  created_at: string
  /** Buyer address snapshots taken at payment (webhook): ship_to_address is the G12
   *  recipient record; shipping_address the older mirror. Either may be null. */
  ship_to_address?: ShipToAddress | null
  shipping_address?: ShipToAddress | null
  /** 'platform' = prepaid EasyPost label (US → US); 'seller' = the seller buys the label (international). */
  label_mode?: 'platform' | 'seller'
  /** 'domestic' or a lib/shipping-regions key. */
  shipping_region?: string | null
}

export type ListingSnap = { title: string; brand: string; size: string; images: string[] }

export const TIMELINE_STATES: OrderState[] = ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'released']

export function formatTs(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return (d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })).toUpperCase()
}

export function countdown(to: Date): string {
  const ms = to.getTime() - Date.now()
  if (ms <= 0) return '0H'
  const days  = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? `${days}D ${hours}H` : `${hours}H`
}

export function orderNumber(id: string): string {
  return `#A-${id.slice(0, 5).toUpperCase()}`
}

export function Timeline({ order }: { order: OrderData }) {
  const current = order.state as OrderState
  const terminal = current === 'refunded' || current === 'cancelled' || current === 'disputed'
  const ts: Partial<Record<OrderState, string | null>> = {
    paid_held: order.paid_at ?? order.created_at,
    seller_confirmed: order.seller_confirmed_at,
    shipped: order.shipped_at,
    delivered: order.delivered_at,
    released: order.released_at,
  }
  // Terminal states sit outside the happy path: mark every step that has a
  // timestamp as done (a dispute after delivery keeps paid → delivered filled).
  const reached = terminal
    ? TIMELINE_STATES.reduce((n, st, i) => (ts[st] ? i : n), -1)
    : TIMELINE_STATES.indexOf(current)
  return (
    <div className="timeline" data-testid="order-timeline">
      {TIMELINE_STATES.map((state, i) => {
        // The order's state is the last step that HAPPENED (money held, seller
        // confirmed, …) — so that step is done and the one after it is "now".
        const done = reached >= i
        const now = !terminal && i === reached + 1
        return (
          <div key={state} className={`timeline__step${done ? ' is-done' : ''}${now ? ' is-now' : ''}`}>
            <span className="timeline__dot" />
            <div>
              <div className="timeline__label">
                {STATE_LABELS[state]}
                {state === 'shipped' && order.tracking_number && <> · {order.carrier ? `${order.carrier.toUpperCase()} ` : ''}{order.tracking_number}</>}
              </div>
              <div className="timeline__meta">{ts[state] ? formatTs(ts[state] ?? null) : now ? 'NOW' : 'PENDING'}</div>
            </div>
          </div>
        )
      })}
      {terminal && (
        <div className="timeline__step is-now">
          <span className="timeline__dot" style={{ borderColor: 'var(--alert)' }} />
          <div>
            <div className="timeline__label" style={{ color: 'var(--alert)' }}>{STATE_LABELS[current]}</div>
            <div className="timeline__meta">{formatTs(order.disputed_at ?? order.refunded_at ?? order.cancelled_at ?? null)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SummaryPanel({ order, listing, role }: { order: OrderData; listing: ListingSnap; role: 'buyer' | 'seller' }) {
  const image = listing.images?.find(Boolean) ?? null
  return (
    <div className="panel">
      <div className="panel__title">ORDER {orderNumber(order.id)}</div>
      <div className="review-item" style={{ marginTop: 0, border: 'none', padding: 0 }}>
        <span className="review-item__thumb" style={{ background: 'var(--tone-2)', overflow: 'hidden' }}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </span>
        <div className="review-item__main">
          <div className="review-item__row">
            <span className="review-item__brand">{listing.brand.toUpperCase()}</span>
          </div>
          <div className="review-item__title" style={{ whiteSpace: 'normal' }}>{listing.title}</div>
          <div className="review-item__meta">{listing.size ? `SIZE ${listing.size.toUpperCase()}` : ''}</div>
        </div>
      </div>
      <div style={{ paddingTop: 12 }}>
        <div className="kv"><span className="kv__k">ITEM</span><span className="kv__v">{formatCents(order.item_cents)}</span></div>
        {role === 'buyer' && order.buyer_fee_cents > 0 && <div className="kv"><span className="kv__k">BUYER FEE</span><span className="kv__v">{formatCents(order.buyer_fee_cents)}</span></div>}
        <div className="kv"><span className="kv__k">SHIPPING</span><span className="kv__v">{formatCents(order.shipping_cents)}</span></div>
        {role === 'buyer' ? (
          <div className="kv kv--total"><span className="kv__k">TOTAL PAID</span><span className="kv__v">{formatCents(order.total_cents)}</span></div>
        ) : (
          <>
            <div className="kv"><span className="kv__k">SELLER FEE</span><span className="kv__v">−{formatCents(order.seller_fee_cents)}</span></div>
            <div className="kv kv--total"><span className="kv__k">YOUR PAYOUT</span><span className="kv__v">{formatCents(order.transfer_cents)}</span></div>
          </>
        )}
      </div>
      <div style={{ paddingTop: 12 }}>
        <PrefetchLink href={`/listings/${order.listing_id}`} className="link-underline">VIEW LISTING →</PrefetchLink>
      </div>
    </div>
  )
}

export function ProtectedPanel({ lines }: { lines: string[] }) {
  return (
    <div className="panel">
      <div className="panel__title">PROTECTED</div>
      {lines.map((t, i) => (
        <div key={i} className="kv"><span className="kv__k" style={{ color: 'var(--ink)' }}>✓</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>{t}</span></div>
      ))}
    </div>
  )
}

/**
 * Seller-only: where to ship. Reads the order's own snapshot (never the buyer's live
 * profile), so a later address-book edit cannot change a paid order's destination.
 */
export function ShipToPanel({ order }: { order: OrderData }) {
  const raw = order.ship_to_address ?? order.shipping_address ?? null
  const a = normalizeShipTo(raw)
  const complete = isShippable(raw)
  return (
    <div className="panel" data-testid="ship-to-panel">
      <div className="panel__title">SHIP TO</div>
      {complete && a ? (
        <div className="mono-note" style={{ paddingTop: 4, lineHeight: 1.6 }}>
          {a.name && <div style={{ color: 'var(--ink)' }}>{a.name.toUpperCase()}</div>}
          {addressLines({ street1: a.street1 ?? '', street2: a.street2 ?? null, city: a.city ?? '', state: a.state ?? '', zip: a.zip ?? '', country: a.country }).map((line, i) => (
            <div key={i}>{line.toUpperCase()}</div>
          ))}
        </div>
      ) : (
        <div className="alert-line" role="alert">NO SHIPPING ADDRESS ON FILE FOR THIS ORDER. MESSAGE THE BUYER BEFORE SHIPPING.</div>
      )}
    </div>
  )
}
