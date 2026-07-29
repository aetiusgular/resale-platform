import { describe, it, expect } from 'vitest'
import {
  evaluateSellerRisk,
  sellerRiskFlagged,
  COMPLAINT_RISK_THRESHOLD,
} from '../../lib/trust/risk-signal'
import {
  scanListing,
  isBlocked,
  highestTier,
} from '../../lib/trust/prohibited-items'

describe('evaluateSellerRisk (RISK half of the G4 trigger)', () => {
  it('a clean seller is not flagged', () => {
    expect(evaluateSellerRisk({ ratings: [5, 5, 4, 5], upheldComplaints: 0 })).toEqual({
      flagged: false,
      reasons: [],
    })
  })

  it('flags on bad ratings alone (delegates to ratingsTriggerRisk)', () => {
    const e = evaluateSellerRisk({ ratings: [1, 1, 2, 2, 3] })
    expect(e.flagged).toBe(true)
    expect(e.reasons).toContain('ratings')
  })

  it('flags at the complaint threshold, not below it', () => {
    expect(evaluateSellerRisk({ upheldComplaints: COMPLAINT_RISK_THRESHOLD - 1 }).flagged).toBe(false)
    const e = evaluateSellerRisk({ upheldComplaints: COMPLAINT_RISK_THRESHOLD })
    expect(e.flagged).toBe(true)
    expect(e.reasons).toContain('complaints')
  })

  it('manual admin flag always wins', () => {
    const e = evaluateSellerRisk({ ratings: [5, 5, 5, 5, 5], upheldComplaints: 0, manualFlag: true })
    expect(e).toEqual({ flagged: true, reasons: ['manual'] })
  })

  it('reports every firing signal (for the audit log)', () => {
    const e = evaluateSellerRisk({ ratings: [1, 1, 1, 1, 1], upheldComplaints: 3, manualFlag: true })
    expect(e.flagged).toBe(true)
    expect(new Set(e.reasons)).toEqual(new Set(['manual', 'ratings', 'complaints']))
  })

  it('sellerRiskFlagged is the boolean the verification gate consumes', () => {
    expect(sellerRiskFlagged({ upheldComplaints: 2 })).toBe(true)
    expect(sellerRiskFlagged({ ratings: [5, 5, 5] })).toBe(false)
  })

  it('an open (un-upheld) complaint count of 0 never flags a good seller', () => {
    // a malicious buyer opening disputes should not, by itself, force verification
    expect(sellerRiskFlagged({ ratings: [5, 4, 5, 5, 4], upheldComplaints: 0 })).toBe(false)
  })
})

describe('scanListing / prohibited items', () => {
  it('clean fashion listing → no matches', () => {
    expect(scanListing({ title: 'Vintage Carhartt jacket', description: 'Great condition, size L' })).toEqual([])
    expect(highestTier({ title: 'Nike Air Max 90' })).toBeNull()
  })

  it('replica language is a REVIEW match, never a block', () => {
    const m = scanListing({ description: 'AAA replica, mirror quality, 1:1' })
    expect(m.length).toBeGreaterThan(0)
    expect(m.every((x) => x.tier === 'review')).toBe(true)
    expect(m.some((x) => x.category === 'counterfeit')).toBe(true)
    expect(isBlocked({ description: 'AAA replica, mirror quality, 1:1' })).toBe(false)
    expect(highestTier({ description: 'replica' })).toBe('review')
  })

  it('explicit weapons are a BLOCK match', () => {
    expect(isBlocked({ title: 'Glock pistol for sale' })).toBe(true)
    expect(isBlocked({ description: 'includes 200 rounds of ammunition' })).toBe(true)
    expect(highestTier({ title: 'firearm' })).toBe('block')
  })

  it('does NOT block streetwear graphics that merely print a word', () => {
    // graphic-tee references must not auto-hide — these belong in review at most
    expect(isBlocked({ title: 'Supreme cannabis leaf tee', description: 'weed graphic print' })).toBe(false)
    expect(isBlocked({ title: 'Gunmetal grey hoodie' })).toBe(false)
  })

  it('captures the matched substring + field for evidence', () => {
    const m = scanListing({ title: 'Selling gift cards' })
    expect(m[0]).toMatchObject({ category: 'currency_giftcard', tier: 'review', field: 'title' })
    expect(m[0].matched.toLowerCase()).toContain('gift')
  })

  it('surfaces multiple categories across fields', () => {
    const m = scanListing({ title: 'replica watch', description: 'comes with a switchblade' })
    const cats = new Set(m.map((x) => x.category))
    expect(cats.has('counterfeit')).toBe(true)
    expect(cats.has('weapons')).toBe(true)
    expect(highestTier({ title: 'replica watch', description: 'switchblade' })).toBe('block')
  })
})
