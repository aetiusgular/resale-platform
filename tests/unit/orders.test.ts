import { describe, it, expect } from 'vitest'
import {
  isLegalTransition,
  isDisputeWindowOpen,
  autoReleaseAt,
  disputeDeadlineAt,
  AUTO_RELEASE_DAYS,
  DISPUTE_WINDOW_HOURS,
  LEGAL_TRANSITIONS,
  type OrderState,
} from '../../lib/orders'

describe('constants', () => {
  it('AUTO_RELEASE_DAYS is 3', () => {
    expect(AUTO_RELEASE_DAYS).toBe(3)
  })
  it('DISPUTE_WINDOW_HOURS is 72', () => {
    expect(DISPUTE_WINDOW_HOURS).toBe(72)
  })
})

describe('isLegalTransition', () => {
  // Legal edges
  const legal: [OrderState, OrderState][] = [
    ['paid_held',        'seller_confirmed'],
    ['paid_held',        'cancelled'],
    ['seller_confirmed', 'shipped'],
    ['seller_confirmed', 'cancelled'],
    ['shipped',          'delivered'],
    ['delivered',        'released'],
    ['delivered',        'disputed'],
    ['disputed',         'released'],
    ['disputed',         'refunded'],
  ]

  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(isLegalTransition(from, to)).toBe(true)
    })
  }

  // Illegal edges
  const illegal: [OrderState, OrderState][] = [
    ['paid_held',  'shipped'],    // skip a step
    ['paid_held',  'delivered'],
    ['shipped',    'released'],   // skip delivered
    ['released',   'disputed'],   // terminal state
    ['refunded',   'released'],   // terminal state
    ['cancelled',  'paid_held'],  // cannot re-open
    ['delivered',  'cancelled'],  // too late to cancel
  ]

  for (const [from, to] of illegal) {
    it(`rejects ${from} → ${to}`, () => {
      expect(isLegalTransition(from, to)).toBe(false)
    })
  }

  it('terminal states (released, refunded, cancelled) have no outgoing transitions', () => {
    const terminals: OrderState[] = ['released', 'refunded', 'cancelled']
    for (const state of terminals) {
      expect(LEGAL_TRANSITIONS[state]).toHaveLength(0)
    }
  })
})

describe('autoReleaseAt', () => {
  it('returns delivered_at + 3 days', () => {
    const delivered = new Date('2026-07-12T11:18:00Z')
    const release   = autoReleaseAt(delivered)
    expect(release.getTime()).toBe(delivered.getTime() + 3 * 24 * 60 * 60 * 1000)
  })
})

describe('disputeDeadlineAt', () => {
  it('returns delivered_at + 72h', () => {
    const delivered = new Date('2026-07-12T11:18:00Z')
    const deadline  = disputeDeadlineAt(delivered)
    expect(deadline.getTime()).toBe(delivered.getTime() + 72 * 60 * 60 * 1000)
  })
})

describe('isDisputeWindowOpen', () => {
  it('returns true when within 72h', () => {
    const delivered = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12h ago
    expect(isDisputeWindowOpen(delivered)).toBe(true)
  })

  it('returns false when beyond 72h', () => {
    const delivered = new Date(Date.now() - 73 * 60 * 60 * 1000) // 73h ago
    expect(isDisputeWindowOpen(delivered)).toBe(false)
  })

  it('returns false exactly at 72h boundary', () => {
    const delivered = new Date(Date.now() - 72 * 60 * 60 * 1000 - 1) // just past
    expect(isDisputeWindowOpen(delivered)).toBe(false)
  })
})
