/**
 * Release-hold preconditions — PURE (no I/O), so the money-critical guard is unit-tested
 * in isolation. A collusion hold parks a payout while the order is in 'released' state
 * with transfer_hold_reason set and NO stripe_transfer_id (funds still in escrow, not yet
 * paid to the seller). Releasing = issuing that transfer. These checks stop a double
 * payout (already transferred), a release of something not actually held, or a release
 * from an unexpected state.
 */
export type ReleasableOrder = {
  state: string
  stripe_transfer_id: string | null
  transfer_hold_reason: string | null
}

export type ReleaseCheck =
  | { ok: true }
  | { ok: false; error: string; status: number; code: string }

export function checkReleasable(order: ReleasableOrder | null | undefined): ReleaseCheck {
  if (!order) return { ok: false, error: 'Order not found', status: 404, code: 'not_found' }
  if (order.stripe_transfer_id) {
    return { ok: false, error: 'This payout has already been sent.', status: 409, code: 'already_transferred' }
  }
  if (!order.transfer_hold_reason) {
    return { ok: false, error: "This order isn't on hold.", status: 422, code: 'not_held' }
  }
  if (order.state !== 'released') {
    return { ok: false, error: `Cannot release a payout from state '${order.state}'.`, status: 422, code: 'bad_state' }
  }
  return { ok: true }
}

/** Human labels for the collusion reason codes surfaced in the admin queue. */
export const COLLUSION_REASON_LABEL: Record<string, string> = {
  shared_bank: 'SHARED BANK',
  shared_card: 'SHARED CARD',
  shared_billing_identity: 'SHARED BILLING IDENTITY',
  ship_to_self: 'SHIP TO SELF',
}

/**
 * Moderator-refund preconditions — PURE. A moderator may refund any pre-release order
 * (funds in escrow) and, additionally, a COLLUSION-HELD 'released' order whose transfer was
 * blocked (stripe_transfer_id IS NULL AND transfer_hold_reason set) — the buyer's money is
 * still in escrow. A 'released' order that already paid out (transfer exists) or that isn't a
 * hold is rejected: that's a clawback/reversal, a separate flow. Terminal states can't refund.
 */
export type RefundableOrder = {
  state: string
  stripe_transfer_id: string | null
  transfer_hold_reason: string | null
}

export function checkModeratorRefund(order: RefundableOrder | null | undefined): ReleaseCheck {
  if (!order) return { ok: false, error: 'Order not found', status: 404, code: 'not_found' }
  if (order.state === 'refunded' || order.state === 'cancelled') {
    return { ok: false, error: `Cannot refund an order in state '${order.state}'.`, status: 422, code: 'not_refundable' }
  }
  if (order.state === 'released') {
    if (order.stripe_transfer_id) {
      return { ok: false, error: 'Those funds already paid out — a clawback is a separate flow.', status: 422, code: 'already_paid_out' }
    }
    if (!order.transfer_hold_reason) {
      return { ok: false, error: 'This released order is not on hold; releasing funds require a clawback.', status: 422, code: 'released_not_held' }
    }
  }
  return { ok: true }
}
