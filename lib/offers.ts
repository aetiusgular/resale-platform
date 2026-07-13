/**
 * Offer engine — state machine helpers for the chat offer flow.
 * State changes are enforced server-side via API routes (not client-direct).
 *
 * Legal transitions:
 *   open   → accepted | declined | countered | expired (cron)
 *   accepted → voided (cron, if buyer doesn't pay within 24h)
 *   All other states are terminal.
 */

export type OfferState =
  | 'open'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'voided'

export interface Offer {
  id: string
  conversation_id: string
  listing_id: string
  from_user: string
  amount_cents: number
  state: OfferState
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  comments_consent_buyer: boolean
  comments_consent_seller: boolean
  created_at: string
  updated_at: string
}

/** Returns true if the offer is still actionable (can be accepted/declined/countered). */
export function isActionable(offer: Offer): boolean {
  return offer.state === 'open'
}

/** Returns the user_id of the party who RECEIVES the offer (can accept/decline/counter). */
export function offerRecipient(offer: Offer, conv: Conversation): string {
  return offer.from_user === conv.buyer_id ? conv.seller_id : conv.buyer_id
}

/**
 * Verify that the caller is allowed to respond to (accept/decline/counter) an offer.
 * The recipient is the party who did NOT send the offer.
 */
export function canRespond(
  offer: Offer,
  conv: Conversation,
  callerId: string,
): boolean {
  return isActionable(offer) && offerRecipient(offer, conv) === callerId
}

/** Compute how many hours remain until an open offer expires (may be negative). */
export function hoursUntilExpiry(offer: Offer): number {
  const ms = new Date(offer.expires_at).getTime() - Date.now()
  return Math.round(ms / 3_600_000)
}

/**
 * Compute how many hours remain in the 24h payment window after offer acceptance.
 * Returns null if accepted_at is not set.
 */
export function hoursUntilPaymentDeadline(offer: Offer): number | null {
  if (!offer.accepted_at) return null
  const deadline = new Date(offer.accepted_at).getTime() + 24 * 3_600_000
  const ms = deadline - Date.now()
  return Math.round(ms / 3_600_000)
}
