'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
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
  price_cents: number
  status: string
  images: string[]
}

interface BuyerStats {
  purchase_count: number
  dispute_count: number
  strike_count: number
  pays_fast: boolean
}

interface Props {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  initialOffers: Offer[]
  conversation: Conversation
  listing: Listing
  buyerStats: BuyerStats | null
  isBuyer: boolean
}

export default function ThreadClient({
  conversationId,
  currentUserId,
  initialMessages,
  initialOffers,
  conversation,
  listing,
  buyerStats,
  isBuyer,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [offers, setOffers] = useState<Offer[]>(initialOffers)
  const [messageText, setMessageText] = useState('')
  const [showOfferInput, setShowOfferInput] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [showConsentBanner, setShowConsentBanner] = useState(
    !conversation.comments_consent_buyer && !conversation.comments_consent_seller,
  )
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Supabase realtime subscription for new messages
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!messageText.trim()) return
    const body = messageText
    setMessageText('')

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      setMessageText(body) // restore on failure
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
        // mark old offer as countered + add new offer
        setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, state: 'countered' as const } : o).concat(data.offer))
      } else {
        setOffers((prev) => prev.map((o) => o.id === offerId ? data.offer : o))
      }
      if (action === 'accept') {
        router.refresh()
      }
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

  // Build a combined chronological timeline of messages + offer events
  type TimelineItem =
    | { type: 'message'; data: Message }
    | { type: 'offer'; data: Offer }

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ type: 'message' as const, data: m })),
    ...offers.map((o) => ({ type: 'offer' as const, data: o })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime())

  const activeOffer = offers.find((o) => o.state === 'open' || o.state === 'accepted')
  const myRole = isBuyer ? 'BUYER' : 'SELLER'
  const otherRole = isBuyer ? 'SELLER' : 'BUYER'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)' }}>
      {/* Pinned listing context bar */}
      <div style={{ borderBottom: '1px solid var(--color-line)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.title} style={{ flex: 'none', width: '40px', aspectRatio: '3/4', objectFit: 'cover', border: '1px solid var(--color-line)' }} />
        ) : (
          <div style={{ flex: 'none', width: '40px', aspectRatio: '3/4', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '6px', color: 'var(--color-ink-soft)' }}>3:4</div>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-ink)', flex: 'none' }}>{formatCents(listing.price_cents)}</span>
        <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', border: '1px solid var(--color-line)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>
          {listing.status.toUpperCase().replace('_', ' ')}
        </span>
        <a href={`/listings/${listing.id}`} style={{ marginLeft: 'auto', flex: 'none', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>View listing</a>
      </div>

      {/* Counterparty record */}
      {buyerStats && (
        <div style={{ borderBottom: '1px solid var(--color-line)', padding: '8px 24px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {otherRole} · {buyerStats.purchase_count} PURCHASES · {buyerStats.dispute_count} DISPUTES
          {buyerStats.strike_count > 0 ? ` · ${buyerStats.strike_count} STRIKES` : ''}
          {buyerStats.pays_fast ? ' · PAYS FAST' : ''}
        </div>
      )}

      {/* Message thread */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {timeline.map((item) => {
          if (item.type === 'message') {
            const msg = item.data
            const isMine = msg.sender_id === currentUserId
            const time = formatTime(msg.created_at)

            if (msg.redacted) {
              return (
                <div key={msg.id} style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                  {msg.body}
                </div>
              )
            }

            return (
              <div key={msg.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '420px' }}>
                <div style={{ border: '1px solid var(--color-line)', borderRadius: '2px', padding: '10px 14px', fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)', background: 'var(--color-bg)' }}>
                  {msg.body}
                </div>
                <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)', textAlign: isMine ? 'right' : 'left' }}>
                  {isMine ? 'you' : `@${myRole.toLowerCase()}`} · {time}
                </div>
              </div>
            )
          }

          // Offer event
          const offer = item.data
          const isDeclined = offer.state === 'declined' || offer.state === 'expired' || offer.state === 'voided' || offer.state === 'countered'
          const isAccepted = offer.state === 'accepted'
          const isOpen = offer.state === 'open'
          const iAmRecipient = offer.from_user !== currentUserId
          const time = formatTime(offer.created_at)

          if (isDeclined) {
            return (
              <div key={offer.id} style={{ border: '1px solid var(--color-line)', borderRadius: '2px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: 'var(--color-ink-soft)', textDecoration: 'line-through' }}>
                  OFFER — {formatCents(offer.amount_cents)}
                </span>
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
                  {offer.state.toUpperCase()} · {time}
                </span>
              </div>
            )
          }

          if (isAccepted) {
            const hoursLeft = hoursUntilPaymentDeadline(offer)
            return (
              <div key={offer.id} style={{ border: '1px solid var(--color-accent)', borderRadius: '2px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--color-ink)' }}>
                    OFFER ACCEPTED — {formatCents(offer.amount_cents)}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>{time}</span>
                </div>
                {hoursLeft !== null && hoursLeft > 0 && (
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
                    pay within {hoursLeft}h to hold the deal — after that the offer voids and counts as a strike.
                  </div>
                )}
                {isBuyer && (
                  <a
                    href={`/checkout/${listing.id}?offerId=${offer.id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', textDecoration: 'none' }}
                  >
                    Pay <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px' }}>{formatCents(offer.amount_cents)}</span> now
                  </a>
                )}
                {!isBuyer && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                    Waiting for buyer to pay within {hoursLeft ?? 24}h.
                  </div>
                )}
              </div>
            )
          }

          if (isOpen) {
            const hrs = hoursUntilExpiry(offer)
            return (
              <div key={offer.id} style={{ border: '1px solid var(--color-ink)', borderRadius: '2px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color: 'var(--color-ink)' }}>
                    OFFER — {formatCents(offer.amount_cents)}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
                    EXPIRES IN {hrs}H
                  </span>
                </div>
                {iAmRecipient ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => startTransition(() => { void respondToOffer(offer.id, 'accept') })}
                      disabled={pending}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 32px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => startTransition(() => { void respondToOffer(offer.id, 'decline') })}
                      disabled={pending}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 24px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer' }}
                    >
                      Decline
                    </button>
                    <CounterButton offerId={offer.id} onCounter={(amt) => startTransition(() => { void respondToOffer(offer.id, 'counter', amt) })} disabled={pending} />
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>Waiting for response.</div>
                )}
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
                  if accepted, buyer must pay within 24h or the offer voids and it counts as a strike.
                </div>
              </div>
            )
          }

          return null
        })}

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
          off-platform payment links are blocked automatically.
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Consent banner */}
      {showConsentBanner && (
        <div style={{ margin: '0 24px 12px', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-ink-soft)' }}>
            Chat transcripts can be referenced in disputes only if both parties consent.{' '}
            <button onClick={() => void toggleConsent()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-ink)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              Give consent
            </button>
          </span>
          <button onClick={() => setShowConsentBanner(false)} style={{ marginLeft: 'auto', flex: 'none', background: 'none', border: 'none', fontSize: '18px', color: 'var(--color-ink-soft)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Offer amount input (shown when Make offer clicked) */}
      {showOfferInput && (
        <div style={{ margin: '0 24px 8px', border: '1px solid var(--color-ink)', borderRadius: '2px', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-ink)' }}>$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="0"
            autoFocus
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)', background: 'transparent' }}
            onKeyDown={(e) => { if (e.key === 'Enter') void makeOffer() }}
          />
          <button onClick={() => void makeOffer()} style={{ height: '36px', padding: '0 20px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: 'pointer' }}>Send offer</button>
          <button onClick={() => setShowOfferInput(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--color-ink-soft)', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Input row */}
      <div style={{ borderTop: '1px solid var(--color-line)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="write a message"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
          style={{ flex: 1, height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none', boxSizing: 'border-box' }}
        />
        {!activeOffer && !showOfferInput && listing.status !== 'sold' && (
          <button
            onClick={() => setShowOfferInput(true)}
            style={{ flex: 'none', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Make offer
          </button>
        )}
        <button
          onClick={() => void sendMessage()}
          disabled={!messageText.trim()}
          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 32px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: 'pointer', opacity: messageText.trim() ? 1 : 0.4 }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function CounterButton({ offerId, onCounter, disabled }: { offerId: string; onCounter: (amt: number) => void; disabled: boolean }) {
  const [show, setShow] = useState(false)
  const [val, setVal] = useState('')

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        disabled={disabled}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '44px', padding: '0 16px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: 'none', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: 'pointer', textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '3px' }}
      >
        Counter
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>$</span>
      <input
        type="number"
        min="1"
        step="1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="amount"
        autoFocus
        style={{ width: '80px', border: '1px solid var(--color-ink)', borderRadius: '2px', padding: '0 8px', height: '36px', fontFamily: 'var(--font-mono)', fontSize: '14px', outline: 'none' }}
        onKeyDown={(e) => { if (e.key === 'Enter') { const c = Math.round(parseFloat(val) * 100); if (c > 0) onCounter(c) } }}
      />
      <button
        onClick={() => { const c = Math.round(parseFloat(val) * 100); if (c > 0) { onCounter(c); setShow(false) } }}
        style={{ height: '36px', padding: '0 14px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: 'none', borderRadius: '2px', font: '500 13px var(--font-ui)', cursor: 'pointer' }}
      >
        Send
      </button>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
