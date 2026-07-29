import { describe, it, expect } from 'vitest'
import {
  aggregateRating,
  isValidStar,
  ratingsTriggerRisk,
  RATING_RISK_MIN_SAMPLE,
} from '../../lib/reviews/rating'
import {
  canLeaveReview,
  reviewDirection,
  REVIEW_ELIGIBLE_STATE,
  type ReviewParties,
} from '../../lib/reviews/eligibility'

describe('isValidStar', () => {
  it('accepts integers 1..5 only', () => {
    expect([1, 2, 3, 4, 5].every(isValidStar)).toBe(true)
    expect(isValidStar(0)).toBe(false)
    expect(isValidStar(6)).toBe(false)
    expect(isValidStar(3.5)).toBe(false)
    expect(isValidStar(Number.NaN)).toBe(false)
  })
})

describe('aggregateRating', () => {
  it('empty set → count 0, null average, 0 low share', () => {
    const s = aggregateRating([])
    expect(s).toEqual({
      count: 0,
      average: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      lowStarShare: 0,
    })
  })

  it('computes count, 1-decimal mean, distribution, and low-star share', () => {
    const s = aggregateRating([5, 5, 4, 2, 1])
    expect(s.count).toBe(5)
    expect(s.average).toBe(3.4) // 17/5 = 3.4
    expect(s.distribution).toEqual({ 1: 1, 2: 1, 3: 0, 4: 1, 5: 2 })
    expect(s.lowStarShare).toBeCloseTo(0.4) // (1 + 1) / 5
  })

  it('drops invalid entries so they cannot skew count or mean', () => {
    const s = aggregateRating([5, 0, 6, 3.5, Number.NaN, 3])
    expect(s.count).toBe(2) // only 5 and 3 are valid
    expect(s.average).toBe(4) // 8/2
  })
})

describe('ratingsTriggerRisk (ratings half of the G4 risk trigger)', () => {
  it('does not trigger below the minimum sample, even if all bad', () => {
    const tinyAllOnes = Array(RATING_RISK_MIN_SAMPLE - 1).fill(1)
    expect(ratingsTriggerRisk(tinyAllOnes)).toBe(false)
  })

  it('triggers on a low mean once sample is sufficient', () => {
    expect(ratingsTriggerRisk([1, 1, 2, 2, 3])).toBe(true) // mean 1.8 ≤ 2.5
  })

  it('triggers on a high low-star share even if some 5★ lift the mean', () => {
    // 1,1,5,5,5 → mean 3.4 (not low) but 2/5 = 0.4 low-star share ≥ floor
    expect(ratingsTriggerRisk([1, 1, 5, 5, 5])).toBe(true)
  })

  it('a healthy seller with enough reviews does not trigger', () => {
    expect(ratingsTriggerRisk([5, 5, 4, 5, 4, 5, 3])).toBe(false)
  })
})

describe('review eligibility', () => {
  const base: ReviewParties = { buyerId: 'buyer-1', sellerId: 'seller-1', state: REVIEW_ELIGIBLE_STATE }

  it('reviewDirection identifies each party, null for a stranger', () => {
    expect(reviewDirection(base, 'buyer-1')).toBe('buyer_to_seller')
    expect(reviewDirection(base, 'seller-1')).toBe('seller_to_buyer')
    expect(reviewDirection(base, 'someone-else')).toBeNull()
  })

  it('allows each party once on a released order', () => {
    expect(canLeaveReview(base, 'buyer-1')).toEqual({ ok: true, direction: 'buyer_to_seller' })
    expect(canLeaveReview(base, 'seller-1')).toEqual({ ok: true, direction: 'seller_to_buyer' })
  })

  it('rejects a non-party', () => {
    expect(canLeaveReview(base, 'stranger')).toEqual({ ok: false, reason: 'not_a_party' })
  })

  it('rejects until the order is released', () => {
    for (const state of ['paid_held', 'shipped', 'delivered', 'disputed', 'refunded', 'cancelled'] as const) {
      expect(canLeaveReview({ ...base, state }, 'buyer-1')).toEqual({
        ok: false,
        reason: 'order_not_completed',
      })
    }
  })

  it('enforces one review per direction', () => {
    expect(
      canLeaveReview(base, 'buyer-1', { existingDirections: ['buyer_to_seller'] }),
    ).toEqual({ ok: false, reason: 'already_reviewed' })
    // the other side is still free to review
    expect(
      canLeaveReview(base, 'seller-1', { existingDirections: ['buyer_to_seller'] }),
    ).toEqual({ ok: true, direction: 'seller_to_buyer' })
  })

  it('never allows a self-order to be reviewed', () => {
    const self: ReviewParties = { buyerId: 'x', sellerId: 'x', state: REVIEW_ELIGIBLE_STATE }
    expect(canLeaveReview(self, 'x')).toEqual({ ok: false, reason: 'self_order' })
  })
})
