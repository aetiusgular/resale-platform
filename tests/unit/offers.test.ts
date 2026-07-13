import { describe, it, expect } from 'vitest'
import {
  isActionable,
  offerRecipient,
  canRespond,
  hoursUntilExpiry,
  hoursUntilPaymentDeadline,
} from '@/lib/offers'
import type { Offer, Conversation } from '@/lib/offers'

const BUYER = 'buyer-uuid'
const SELLER = 'seller-uuid'
const LISTING = 'listing-uuid'
const CONV_ID = 'conv-uuid'

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONV_ID,
    listing_id: LISTING,
    buyer_id: BUYER,
    seller_id: SELLER,
    comments_consent_buyer: false,
    comments_consent_seller: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-uuid',
    conversation_id: CONV_ID,
    listing_id: LISTING,
    from_user: BUYER,
    amount_cents: 100000,
    state: 'open',
    expires_at: new Date(Date.now() + 20 * 3600_000).toISOString(),
    accepted_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('isActionable', () => {
  it('true for open offers', () => expect(isActionable(makeOffer())).toBe(true))
  it('false for accepted', () => expect(isActionable(makeOffer({ state: 'accepted' }))).toBe(false))
  it('false for declined', () => expect(isActionable(makeOffer({ state: 'declined' }))).toBe(false))
  it('false for expired', () => expect(isActionable(makeOffer({ state: 'expired' }))).toBe(false))
  it('false for voided', () => expect(isActionable(makeOffer({ state: 'voided' }))).toBe(false))
  it('false for countered', () => expect(isActionable(makeOffer({ state: 'countered' }))).toBe(false))
})

describe('offerRecipient', () => {
  it('returns seller when buyer made offer', () => {
    expect(offerRecipient(makeOffer({ from_user: BUYER }), makeConv())).toBe(SELLER)
  })
  it('returns buyer when seller made offer', () => {
    expect(offerRecipient(makeOffer({ from_user: SELLER }), makeConv())).toBe(BUYER)
  })
})

describe('canRespond', () => {
  it('seller can respond to buyer offer', () => {
    expect(canRespond(makeOffer({ from_user: BUYER }), makeConv(), SELLER)).toBe(true)
  })
  it('buyer cannot respond to their own offer', () => {
    expect(canRespond(makeOffer({ from_user: BUYER }), makeConv(), BUYER)).toBe(false)
  })
  it('no one can respond to non-open offer', () => {
    expect(canRespond(makeOffer({ state: 'accepted' }), makeConv(), SELLER)).toBe(false)
  })
})

describe('hoursUntilExpiry', () => {
  it('returns positive hours for future expiry', () => {
    const offer = makeOffer({ expires_at: new Date(Date.now() + 21 * 3600_000).toISOString() })
    expect(hoursUntilExpiry(offer)).toBeGreaterThan(0)
  })
  it('returns negative hours for past expiry', () => {
    const offer = makeOffer({ expires_at: new Date(Date.now() - 3600_000).toISOString() })
    expect(hoursUntilExpiry(offer)).toBeLessThan(0)
  })
})

describe('hoursUntilPaymentDeadline', () => {
  it('returns null when not yet accepted', () => {
    expect(hoursUntilPaymentDeadline(makeOffer({ accepted_at: null }))).toBeNull()
  })
  it('returns ~24 immediately after acceptance', () => {
    const acceptedNow = makeOffer({
      state: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    const h = hoursUntilPaymentDeadline(acceptedNow)
    expect(h).not.toBeNull()
    expect(h!).toBeGreaterThanOrEqual(23)
    expect(h!).toBeLessThanOrEqual(24)
  })
  it('returns negative for overdue accepted offer', () => {
    const old = makeOffer({
      state: 'accepted',
      accepted_at: new Date(Date.now() - 25 * 3600_000).toISOString(),
    })
    const h = hoursUntilPaymentDeadline(old)
    expect(h).not.toBeNull()
    expect(h!).toBeLessThan(0)
  })
})
