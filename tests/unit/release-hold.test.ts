import { describe, it, expect } from 'vitest'
import { checkReleasable, checkModeratorRefund, COLLUSION_REASON_LABEL } from '../../lib/trust/release-hold'

const held = { state: 'released', stripe_transfer_id: null, transfer_hold_reason: 'shared_card' }

describe('checkReleasable', () => {
  it('allows releasing a held, released, not-yet-transferred order', () => {
    expect(checkReleasable(held)).toEqual({ ok: true })
  })

  it('404s a missing order', () => {
    expect(checkReleasable(null).ok).toBe(false)
    expect(checkReleasable(undefined)).toMatchObject({ ok: false, status: 404, code: 'not_found' })
  })

  it('409s an already-transferred payout (no double payout)', () => {
    expect(checkReleasable({ ...held, stripe_transfer_id: 'tr_123' })).toMatchObject({ ok: false, status: 409, code: 'already_transferred' })
  })

  it('422s an order that is not actually on hold', () => {
    expect(checkReleasable({ ...held, transfer_hold_reason: null })).toMatchObject({ ok: false, status: 422, code: 'not_held' })
  })

  it('422s a release from an unexpected state', () => {
    expect(checkReleasable({ ...held, state: 'delivered' })).toMatchObject({ ok: false, status: 422, code: 'bad_state' })
  })

  it('maps collusion reason codes to labels', () => {
    expect(COLLUSION_REASON_LABEL.shared_bank).toBe('SHARED BANK')
    expect(COLLUSION_REASON_LABEL.ship_to_self).toBe('SHIP TO SELF')
  })
})

describe('checkModeratorRefund', () => {
  const preRelease = { state: 'delivered', stripe_transfer_id: null, transfer_hold_reason: null }
  const heldReleased = { state: 'released', stripe_transfer_id: null, transfer_hold_reason: 'shared_card' }

  it('allows refund on a pre-release (escrow) order', () => {
    expect(checkModeratorRefund(preRelease)).toEqual({ ok: true })
    expect(checkModeratorRefund({ ...preRelease, state: 'paid_held' }).ok).toBe(true)
    expect(checkModeratorRefund({ ...preRelease, state: 'disputed' }).ok).toBe(true)
  })

  it('allows refund on a collusion-held released order (funds still in escrow)', () => {
    expect(checkModeratorRefund(heldReleased)).toEqual({ ok: true })
  })

  it('blocks refund once a released order has paid out (transfer exists)', () => {
    expect(checkModeratorRefund({ ...heldReleased, stripe_transfer_id: 'tr_9' }))
      .toMatchObject({ ok: false, status: 422, code: 'already_paid_out' })
  })

  it('blocks refund on a released order that is not a hold', () => {
    expect(checkModeratorRefund({ state: 'released', stripe_transfer_id: null, transfer_hold_reason: null }))
      .toMatchObject({ ok: false, status: 422, code: 'released_not_held' })
  })

  it('blocks refund on terminal states', () => {
    expect(checkModeratorRefund({ ...preRelease, state: 'refunded' })).toMatchObject({ ok: false, code: 'not_refundable' })
    expect(checkModeratorRefund({ ...preRelease, state: 'cancelled' })).toMatchObject({ ok: false, code: 'not_refundable' })
  })

  it('404s a missing order', () => {
    expect(checkModeratorRefund(null)).toMatchObject({ ok: false, status: 404 })
  })
})
