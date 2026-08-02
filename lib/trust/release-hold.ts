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
