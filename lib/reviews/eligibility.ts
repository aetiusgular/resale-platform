/**
 * Review eligibility — PURE. Decides whether a given user may review a given
 * order, and in which direction. No DB read here; the caller supplies the order's
 * parties + state and any reviews that already exist for it.
 *
 * Rules (mirrors Grailed-style post-transaction reviews):
 *   1. Only the two parties to the order may review it (buyer or seller).
 *   2. Reviews are allowed only once the transaction actually COMPLETED — i.e.
 *      funds were released ('released'). Cancelled / refunded / disputed / in-flight
 *      orders yield no review, so an unwound or abandoned transaction can't seed
 *      reputation.
 *   3. One review per direction per order (a party can't review the same order twice).
 *
 * The DB is still the source of truth for parties/state and must enforce the same
 * eligibility in RLS/policy; this keeps the rule in one testable place for the
 * route + UI to share.
 */
import type { OrderState } from '@/lib/orders'

/** The only order state a review may follow: the completed (funds-released) sale. */
export const REVIEW_ELIGIBLE_STATE: OrderState = 'released'

export type ReviewDirection = 'buyer_to_seller' | 'seller_to_buyer'

export type ReviewParties = {
  buyerId: string
  sellerId: string
  state: OrderState
}

export type EligibilityResult =
  | { ok: true; direction: ReviewDirection }
  | { ok: false; reason: 'self_order' | 'not_a_party' | 'order_not_completed' | 'already_reviewed' }

/** Which direction this reviewer would be reviewing, or null if they aren't a party. */
export function reviewDirection(order: ReviewParties, reviewerId: string): ReviewDirection | null {
  if (reviewerId === order.buyerId) return 'buyer_to_seller'
  if (reviewerId === order.sellerId) return 'seller_to_buyer'
  return null
}

/**
 * Whether `reviewerId` may leave a review on `order`. Pass any directions that
 * already have a review via `opts.existingDirections` to enforce one-per-direction.
 */
export function canLeaveReview(
  order: ReviewParties,
  reviewerId: string,
  opts: { existingDirections?: ReviewDirection[] } = {},
): EligibilityResult {
  // Defensive: a self-order (same id both sides) should never be reviewable.
  if (order.buyerId === order.sellerId) return { ok: false, reason: 'self_order' }
  const direction = reviewDirection(order, reviewerId)
  if (!direction) return { ok: false, reason: 'not_a_party' }
  if (order.state !== REVIEW_ELIGIBLE_STATE) return { ok: false, reason: 'order_not_completed' }
  if (opts.existingDirections?.includes(direction)) return { ok: false, reason: 'already_reviewed' }
  return { ok: true, direction }
}
