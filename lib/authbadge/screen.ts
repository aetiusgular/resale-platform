/**
 * Authentication pre-screen — PURE. Decides whether a listing should enter the
 * "Authenticated" review queue (G5) before a human/badge decision. No I/O.
 *
 * Two triggers, matching the roadmap: HIGH VALUE (grails worth authenticating) and
 * already-FLAGGED by the anti-slop layer (`listing_flags`: 'duplicate',
 * 'keyword_stuffing', or the G6 'prohibited_*' types). Returns the firing reasons so
 * the queue row / audit can record WHY it was pulled.
 *
 * The price threshold is a product/T&S choice, not a legal one — tune freely.
 */

/** Trailing/list price at or above which a listing is auto-queued for authentication. */
export const AUTH_REVIEW_PRICE_CENTS = 50_000 // $500

export type ScreenReason = 'high_value' | 'flagged'

export interface ScreenInput {
  priceCents: number
  /** listing_flags.type values already raised for this listing (may be empty). */
  flagTypes?: readonly string[]
}

export interface ScreenResult {
  review: boolean
  reasons: ScreenReason[]
}

/** Pure: does list price alone put a listing over the high-value bar? */
export function isHighValue(priceCents: number): boolean {
  return Number.isFinite(priceCents) && priceCents >= AUTH_REVIEW_PRICE_CENTS
}

/**
 * Decide whether a listing needs authentication review, and why. `review` is true iff
 * at least one reason fired; `reasons` lists every trigger for the queue/audit record.
 */
export function needsAuthenticationReview(input: ScreenInput): ScreenResult {
  const reasons: ScreenReason[] = []
  if (isHighValue(input.priceCents)) reasons.push('high_value')
  if (input.flagTypes && input.flagTypes.length > 0) reasons.push('flagged')
  return { review: reasons.length > 0, reasons }
}
