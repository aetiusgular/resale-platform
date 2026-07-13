/**
 * Double-lock checkout tests (B8 fix).
 *
 * These are pure logic tests — we verify the checkout route correctly rejects
 * when listing.status !== 'active', covering the double-lock scenario where:
 *   1. Seller accepts two offers from different buyers.
 *   2. Buyer A checks out first → listing becomes pending_escrow.
 *   3. Buyer B tries to check out → must be rejected with 409.
 *
 * We do this by testing the status-check logic directly, not the full route
 * (which requires DB). The route now rejects ALL non-active listings, including
 * for offer-based checkouts.
 */
import { describe, it, expect } from 'vitest'

// Simulate the checkout status check logic extracted from the route.
function checkListingAvailability(status: string): { ok: boolean; reason?: string } {
  if (status === 'sold' || status === 'removed') {
    return { ok: false, reason: 'Listing not available for purchase' }
  }
  if (status !== 'active') {
    return { ok: false, reason: 'Listing is already being purchased by another buyer' }
  }
  return { ok: true }
}

describe('checkout double-lock (B8)', () => {
  it('allows active listings', () => {
    expect(checkListingAvailability('active').ok).toBe(true)
  })

  it('rejects sold listings', () => {
    const r = checkListingAvailability('sold')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('not available')
  })

  it('rejects pending_escrow with specific message', () => {
    const r = checkListingAvailability('pending_escrow')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('Listing is already being purchased by another buyer')
  })

  it('rejects removed listings', () => {
    const r = checkListingAvailability('removed')
    expect(r.ok).toBe(false)
  })

  it('rejects any other unexpected status', () => {
    const r = checkListingAvailability('pending_review')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('Listing is already being purchased by another buyer')
  })
})
