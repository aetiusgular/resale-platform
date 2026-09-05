'use client'

/**
 * Conversation thread (design 1A): thread bar (counterparty · rating/sales ·
 * VIEW PROFILE · REPORT), pinned listing strip, message stream with day lines /
 * system lines (redactions, order events) / offer cards, composer with MAKE
 * OFFER + SEND. Realtime via Supabase channel; incoming messages move the read
 * cursor (POST …/read) so the header badge stays accurate.
 *
 * Offer flow (reference): OFFER FROM @x → ACCEPT / COUNTER / DECLINE.
 *   accepted → chip ACCEPTED + PROCEED TO CHECKOUT → (buyer)
 *   countered → chip COUNTERED, then a second card YOUR COUNTER · PENDING · AWAITING @x
 *   declined → chip DECLINED
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import PrefetchLink from '@/app/components/prefetch-link'
import { formatCents } from '@/lib/fees'
import { hoursUntilExpiry, hoursUntilPaymentDeadline } from '@/lib/offers'
import type { Offer } from '@/lib/offers'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  redacted: boolean
  created_at: string
}

interface Conversation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  comments_consent_buyer: boolean
  comments_consent_seller: boolean
}

interface Listing {
  id: string
  title: string
  brand: string
  size: string
  price_cents: number
  status: string
  images: string[]
}

interface OrderEvents {
  id: string
  state: string
  carrier: string | null
  tracking_number: string | null
  transfer_cents: number
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  released_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  disputed_at: string | null
}

interface Props {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  initialOffers: Offer[]
  conversation: Conversation
  listing: Listing
  order: OrderEvents | null
  isBuyer: boolean
  /** ?counter=<offerId> from the notifications popout — opens the counter field on that card. */
  counterOfferId: string | null
  other: { username: string; verified: boolean; meta: string }
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
}
function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Order milestones rendered as system lines at their timestamps (reference sys rows). */
function orderSysLines(order: OrderEvents | null, isBuyer: boolean): Array<{ id: string; text: string; created_at: string }> {
  if (!order) return []
  const out: Array<{ id: string; text: string; created_at: string }> = []
  if (order.paid_at) out.push({ id: `${order.id}:paid`, text: isBuyer ? 'PAID · FUNDS HELD IN ESCROW' : 'PAID · FUNDS HELD IN ESCROW UNTIL DELIVERY', created_at: order.paid_at })
  if (order.shipped_at) out.push({ id: `${order.id}:shipped`, text: `TRACKING ADDED · ${[order.carrier, order.tracking_number].filter(Boolean).join(' ').toUpperCase() || 'SHIPPED'}`, created_at: order.shipped_at })
  if (order.delivered_at) out.push({ id: `${order.id}:delivered`, text: 'DELIVERED · BUYER CONFIRMED', created_at: order.delivered_at })
  if (order.released_at) out.push({ id: `${order.id}:released`, text: isBuyer ? 'ORDER COMPLETE' : `ORDER COMPLETE · ${formatCents(order.transfer_cents)} PAYOUT SENT`, created_at: order.released_at })
  if (order.disputed_at) out.push({ id: `${order.id}:disputed`, text: 'DISPUTE OPENED · ESCROW ON HOLD', created_at: order.disputed_at })
  if (order.refunded_at) out.push({ id: `${order.id}:refunded`, text: 'ORDER REFUNDED', created_at: order.refunded_at })
  if (order.cancelled_at) out.push({ id: `${order.id}:cancelled`, text: 'ORDER CANCELLED', created_at: order.cancelled_at })
  return out
}

export default function ThreadClient({
  conversationId,
  currentUserId,
  initialMessages,
  initialOffers,
  conversation,
  listing,
  order,
  isBuyer,
  counterOfferId,
  other,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [offers, setOffers] = useState<Offer[]>(initialOffers)
  const [messageText, setMessageText] = useState('')
  const [showOfferInput, setShowOfferInput] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [sendError, setSendError] = useState('')
  const [reportState, setReportState] = useState<'idle' | 'confirm' | 'sent'>('idle')
  const [showConsentBanner, setShowConsentBanner] = useState(
    !conversation.comments_consent_buyer && !conversation.comments_consent_seller,
  )
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Supabase realtime subscription for new messages; an incoming message moves
  // the read cursor so the header badge doesn't count what is on screen.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]))
          if (newMsg.sender_id !== currentUserId) {
            fetch(`/api/conversations/${conversationId}/read`, { method: 'POST', keepalive: true }).catch(() => {})
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, currentUserId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, offers])

  async function sendMessage() {
    if (!messageText.trim()) return
    const body = messageText
    setMessageText('')
    setSendError('')
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      setMessageText(body) // restore on failure
      const d = await res.json().catch(() => ({}))
      setSendError((d.error ?? 'Message not sent — try again.').toUpperCase())
    }
    // Realtime subscription picks up the new message
  }

  async function makeOffer() {
    const cents = Math.round(parseFloat(offerAmount) * 100)
    if (!cents || cents <= 0) return
    setShowOfferInput(false)
    setOfferAmount('')
    const res = await fetch(`/api/conversations/${conversationId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: cents }),
    })
    if (res.ok) {
      const { offer } = await res.json()
      setOffers((prev) => [...prev, offer])
    } else {
      const d = await res.json().catch(() => ({}))
      setSendError((d.error ?? 'Offer not sent — try again.').toUpperCase())
    }
  }

  async function respondToOffer(offerId: string, action: 'accept' | 'decline' | 'counter', counterCents?: number) {
    const url = `/api/conversations/${conversationId}/offers/${offerId}/${action}`
    const body = action === 'counter' ? JSON.stringify({ amountCents: counterCents }) : undefined
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body,
    })
    if (res.ok) {
      const data = await res.json()
      if (action === 'counter') {
        setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, state: 'countered' as const } : o)).concat(data.offer))
      } else {
        setOffers((prev) => prev.map((o) => (o.id === offerId ? data.offer : o)))
      }
      if (action === 'accept') router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setSendError((d.error ?? 'Could not respond to the offer.').toUpperCase())
    }
  }

  async function toggleConsent() {
    const myConsent = isBuyer ? conversation.comments_consent_buyer : conversation.comments_consent_seller
    await fetch(`/api/conversations/${conversationId}/consent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: !myConsent }),
    })
    setShowConsentBanner(false)
  }

  async function sendReport() {
    setReportState('sent')
    await fetch(`/api/conversations/${conversationId}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Reported from the thread bar' }),
    }).catch(() => {})
  }

  type TimelineItem =
    | { type: 'message'; data: Message }
    | { type: 'offer'; data: Offer }
    | { type: 'sys'; data: { id: string; text: string; created_at: string } }

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ type: 'message' as const, data: m })),
    ...offers.map((o) => ({ type: 'offer' as const, data: o })),
    ...orderSysLines(order, isBuyer).map((s) => ({ type: 'sys' as const, data: s })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime())

  const activeOffer = offers.find((o) => o.state === 'open' || o.state === 'accepted')
  const sold = listing.status === 'sold'
  const canOffer = !activeOffer && listing.status === 'active'
  const otherInitials = other.username.slice(0, 2).toUpperCase()
  const handleUpper = `@${other.username.toUpperCase()}`

  // Day separators: an item opens a new day when its key differs from the previous item's.
  const dayKeys = timeline.map((item) => dayKey(item.data.created_at))
  // An offer that follows a countered one from the other side is "YOUR COUNTER".
  const counterOf = new Map<string, boolean>()
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i]
    const prev = offers[i - 1]
    if (prev && prev.state === 'countered' && prev.from_user !== o.from_user) counterOf.set(o.id, true)
  }

  return (
    <div className="thread" data-testid="thread">
      <div className="thread__bar">
        <PrefetchLink href="/messages" className="thread__back" aria-label="Back to inbox" data-testid="messages-back">←</PrefetchLink>
        <span className="thread__avatar">{otherInitials}</span>
        <span className="thread__handle">@{other.username}</span>
        {other.verified && <span className="tag">VERIFIED</span>}
        <span className="thread__meta">{other.meta}</span>
        <span className="spacer" />
        <PrefetchLink href={`/sellers/${other.username}`} className="link-underline link-underline--ink thread__profile">VIEW PROFILE</PrefetchLink>
        {/* Mobile web (26): the back row carries VIEW LISTING; the strip's VIEW → hides there. */}
        <PrefetchLink href={`/listings/${listing.id}`} className="link-underline thread__viewlisting">VIEW LISTING</PrefetchLink>
        {reportState === 'idle' && (
          <button type="button" className="link-underline" onClick={() => setReportState('confirm')} data-testid="report-btn">REPORT</button>
        )}
        {reportState === 'confirm' && (
          <span className="row" style={{ gap: 10 }}>
            <span className="mono-note mono-note--sub">REPORT THIS CONVERSATION?</span>
            <button type="button" className="link-underline link-underline--ink" onClick={() => void sendReport()}>CONFIRM</button>
            <button type="button" className="link-underline" onClick={() => setReportState('idle')}>CANCEL</button>
          </span>
        )}
        {reportState === 'sent' && <span className="mono-note mono-note--sub">REPORTED ✓</span>}
      </div>

      <div className="listing-strip">
        <span className="listing-strip__thumb" style={{ background: 'var(--tone-2)', overflow: 'hidden' }}>
          {listing.images?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </span>
        <div className="listing-strip__main">
          <div className="listing-strip__row">
            <span className="listing-strip__brand">{listing.brand.toUpperCase()}</span>
            <span className="listing-strip__title">{listing.title}</span>
          </div>
          <div className="listing-strip__role">{isBuyer ? 'YOU ARE BUYING' : 'YOU ARE SELLING'}</div>
          <div className="listing-strip__m">{formatCents(listing.price_cents)} · SIZE {listing.size.toUpperCase()}</div>
        </div>
        <span className="listing-strip__size">SIZE {listing.size.toUpperCase()}</span>
        <span className="listing-strip__price">{formatCents(listing.price_cents)}</span>
        <span className={`tag${sold ? ' tag--solid' : ''}`}>{sold ? 'SOLD' : listing.status === 'active' ? 'FOR SALE' : listing.status.toUpperCase().replace('_', ' ')}</span>
        <PrefetchLink className="link-underline link-underline--ink" href={`/listings/${listing.id}`}>VIEW →</PrefetchLink>
      </div>

      <div className="thread__scroll" data-testid="thread-scroll">
        {timeline.map((item, i) => {
          const dayNode = i === 0 || dayKeys[i] !== dayKeys[i - 1] ? <div className="day-line">{dayLabel(item.data.created_at)}</div> : null

          if (item.type === 'sys') {
            return (
              <div key={item.data.id} style={{ display: 'contents' }}>
                {dayNode}
                <div className="sys-line">{item.data.text}</div>
              </div>
            )
          }

          if (item.type === 'message') {
            const msg = item.data
            const isMine = msg.sender_id === currentUserId
            if (msg.redacted) {
              return (
                <div key={msg.id} style={{ display: 'contents' }}>
                  {dayNode}
                  <div className="sys-line">CONTACT OR PAYMENT LINK REMOVED — KEEP CONTACT ON ARCHIVE</div>
                </div>
              )
            }
            return (
              <div key={msg.id} style={{ display: 'contents' }}>
                {dayNode}
                <div className={`bubble-wrap bubble-wrap--${isMine ? 'me' : 'them'}`}>
                  <div className={`bubble bubble--${isMine ? 'me' : 'them'}`}>{msg.body}</div>
                  <div className={`bubble__time${isMine ? ' bubble__time--right' : ''}`}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            )
          }

          const offer = item.data
          const mine = offer.from_user === currentUserId
          const isCounter = counterOf.get(offer.id) === true
          const label = mine ? (isCounter ? 'YOUR COUNTER' : 'YOUR OFFER') : isCounter ? `COUNTER FROM ${handleUpper}` : `OFFER FROM ${handleUpper}`
          const pct = Math.round((1 - offer.amount_cents / listing.price_cents) * 100)
          const sub = `LIST ${formatCents(listing.price_cents)} · ${pct > 0 ? `${pct}% BELOW` : pct < 0 ? `${-pct}% ABOVE` : 'AT LIST'}`
          const chip = (text: string, on: boolean) => <span className={`offer-chip${on ? ' is-on' : ''}`}>{text}</span>

          if (offer.state === 'open') {
            const hrs = hoursUntilExpiry(offer)
            return (
              <div key={offer.id} style={{ display: 'contents' }}>
                {dayNode}
                <div className={`offer-card${mine ? ' offer-card--mine' : ''}`} data-testid="offer-card">
                  <div className="offer-card__head">
                    <span className="offer-card__label">{label}</span>
                    {mine ? chip('PENDING', false) : chip(`EXPIRES IN ${hrs}H`, false)}
                  </div>
                  <div className="offer-card__row">
                    <span className="offer-card__amount">{formatCents(offer.amount_cents)}</span>
                    <span className="offer-card__sub">{mine ? `AWAITING ${handleUpper}` : sub}</span>
                  </div>
                  {!mine && (
                    <>
                      <div className="offer-card__actions">
                        <button type="button" className="btn-mini btn-mini--solid" disabled={pending} onClick={() => startTransition(() => { void respondToOffer(offer.id, 'accept') })} data-testid="offer-accept">ACCEPT</button>
                        <CounterButton disabled={pending} initialOpen={counterOfferId === offer.id} onCounter={(amt) => startTransition(() => { void respondToOffer(offer.id, 'counter', amt) })} />
                        <button type="button" className="btn-mini btn-mini--link" disabled={pending} onClick={() => startTransition(() => { void respondToOffer(offer.id, 'decline') })} data-testid="offer-decline">DECLINE</button>
                      </div>
                      <div className="offer-card__sub" style={{ paddingTop: 10, whiteSpace: 'normal' }}>IF ACCEPTED, THE BUYER PAYS WITHIN 24H OR THE OFFER VOIDS AND COUNTS AS A STRIKE.</div>
                    </>
                  )}
                </div>
              </div>
            )
          }

          if (offer.state === 'accepted') {
            const hoursLeft = hoursUntilPaymentDeadline(offer)
            return (
              <div key={offer.id} style={{ display: 'contents' }}>
                {dayNode}
                <div className={`offer-card${mine ? ' offer-card--mine' : ''}`} data-testid="offer-card">
                  <div className="offer-card__head">
                    <span className="offer-card__label">{label}</span>
                    {chip('ACCEPTED', true)}
                  </div>
                  <div className="offer-card__row">
                    <span className="offer-card__amount">{formatCents(offer.amount_cents)}</span>
                    <span className="offer-card__sub">{hoursLeft !== null && hoursLeft > 0 ? `PAY WITHIN ${hoursLeft}H` : 'PAYMENT WINDOW CLOSED'}</span>
                  </div>
                  {isBuyer ? (
                    <div className="offer-card__go">
                      <a href={`/checkout/${listing.id}?offerId=${offer.id}`} className="link-underline link-underline--ink" data-testid="pay-now">PROCEED TO CHECKOUT →</a>
                    </div>
                  ) : (
                    <div className="offer-card__sub" style={{ paddingTop: 12 }}>WAITING FOR THE BUYER TO PAY{hoursLeft !== null ? ` · ${hoursLeft}H LEFT` : ''}</div>
                  )}
                </div>
              </div>
            )
          }

          // declined / expired / voided / countered — chip only, amount stays legible.
          return (
            <div key={offer.id} style={{ display: 'contents' }}>
              {dayNode}
              <div className={`offer-card${mine ? ' offer-card--mine' : ''}`} style={{ borderColor: 'var(--line)' }} data-testid="offer-card">
                <div className="offer-card__head">
                  <span className="offer-card__label">{label}</span>
                  {chip(offer.state.toUpperCase(), false)}
                </div>
                <div className="offer-card__row">
                  <span className="offer-card__amount" style={offer.state === 'countered' ? undefined : { color: 'var(--faint)' }}>{formatCents(offer.amount_cents)}</span>
                  <span className="offer-card__sub">{offer.state === 'countered' ? sub : formatTime(offer.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}

        <div className="sys-line">OFF-PLATFORM PAYMENT LINKS AND CONTACT DETAILS ARE REMOVED AUTOMATICALLY — KEEP CONTACT ON ARCHIVE</div>
        <div ref={bottomRef} />
      </div>

      {showConsentBanner && (
        <div className="push-banner" style={{ margin: '0 28px 10px' }}>
          <span>Chat transcripts can be referenced in disputes only if both parties consent.</span>
          <span className="row" style={{ gap: 14 }}>
            <button type="button" className="link-underline link-underline--ink" onClick={() => void toggleConsent()}>GIVE CONSENT</button>
            <button type="button" className="link-underline" onClick={() => setShowConsentBanner(false)}>LATER</button>
          </span>
        </div>
      )}

      {showOfferInput && (
        <div className="offer-compose">
          <span className="offer-card__label">YOUR OFFER · LIST {formatCents(listing.price_cents)}</span>
          <span className="offer-compose__field">
            <span className="offer-compose__dollar">$</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="0"
              autoFocus
              aria-label="Offer amount in USD"
              onKeyDown={(e) => { if (e.key === 'Enter') void makeOffer() }}
            />
          </span>
          <button type="button" className="btn-mini btn-mini--solid" onClick={() => void makeOffer()} data-testid="send-offer">SEND OFFER</button>
          <button type="button" className="btn-mini btn-mini--link" onClick={() => setShowOfferInput(false)}>CANCEL</button>
        </div>
      )}
      {sendError && <div className="alert-line" style={{ padding: '0 28px 8px' }} role="alert">{sendError}</div>}

      <div className="thread__composer">
        {canOffer && !showOfferInput && (
          <button type="button" className="btn-outline btn-outline--mono" onClick={() => setShowOfferInput(true)} data-testid="make-offer-btn">MAKE OFFER</button>
        )}
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Write a message"
          aria-label="Write a message"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
          data-testid="message-input"
        />
        <button type="button" className="btn-send" onClick={() => void sendMessage()} disabled={!messageText.trim()} data-testid="send-btn">SEND →</button>
      </div>
    </div>
  )
}

function CounterButton({ onCounter, disabled, initialOpen = false }: { onCounter: (amt: number) => void; disabled: boolean; initialOpen?: boolean }) {
  const [show, setShow] = useState(initialOpen)
  const [val, setVal] = useState('')
  const submit = () => {
    const c = Math.round(parseFloat(val) * 100)
    if (c > 0) { onCounter(c); setShow(false) }
  }
  if (!show) {
    return <button type="button" className="btn-mini btn-mini--outline" disabled={disabled} onClick={() => setShow(true)} data-testid="offer-counter">COUNTER</button>
  }
  return (
    <span className="offer-compose__field offer-compose__field--inline">
      <span className="offer-compose__dollar">$</span>
      <input type="number" min="1" step="1" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="amount" autoFocus aria-label="Counter amount in USD" onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      <button type="button" className="btn-mini btn-mini--solid" onClick={submit}>SEND</button>
    </span>
  )
}
