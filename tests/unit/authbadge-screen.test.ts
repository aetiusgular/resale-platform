import { describe, it, expect } from 'vitest'
import {
  needsAuthenticationReview,
  isHighValue,
  AUTH_REVIEW_PRICE_CENTS,
} from '../../lib/authbadge/screen'

describe('isHighValue', () => {
  it('inclusive at the threshold', () => {
    expect(isHighValue(AUTH_REVIEW_PRICE_CENTS)).toBe(true)
    expect(isHighValue(AUTH_REVIEW_PRICE_CENTS - 1)).toBe(false)
    expect(isHighValue(AUTH_REVIEW_PRICE_CENTS + 1)).toBe(true)
  })
  it('fail-safe on unusable price', () => {
    expect(isHighValue(Number.NaN)).toBe(false)
  })
})

describe('needsAuthenticationReview', () => {
  it('clean cheap listing → no review', () => {
    expect(needsAuthenticationReview({ priceCents: 4000 })).toEqual({ review: false, reasons: [] })
  })

  it('high value alone triggers', () => {
    const r = needsAuthenticationReview({ priceCents: 80_000 })
    expect(r.review).toBe(true)
    expect(r.reasons).toEqual(['high_value'])
  })

  it('an existing flag alone triggers, regardless of price', () => {
    const r = needsAuthenticationReview({ priceCents: 2000, flagTypes: ['duplicate'] })
    expect(r.review).toBe(true)
    expect(r.reasons).toEqual(['flagged'])
  })

  it('both triggers report both reasons', () => {
    const r = needsAuthenticationReview({ priceCents: 90_000, flagTypes: ['keyword_stuffing'] })
    expect(r.review).toBe(true)
    expect(new Set(r.reasons)).toEqual(new Set(['high_value', 'flagged']))
  })

  it('empty flag list is not a trigger', () => {
    expect(needsAuthenticationReview({ priceCents: 3000, flagTypes: [] })).toEqual({
      review: false,
      reasons: [],
    })
  })
})
