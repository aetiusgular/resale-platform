import { describe, it, expect } from 'vitest'
import {
  salesTriggersVerification,
  sellerRequiresIdVerification,
  SELLER_VERIFICATION_SALES_CENTS,
} from '../../lib/idv/verification-policy'

describe('salesTriggersVerification (pure $5k volume trigger)', () => {
  it('threshold is exactly $5,000 in integer cents', () => {
    expect(SELLER_VERIFICATION_SALES_CENTS).toBe(500_000)
  })

  it('does NOT trigger below the threshold', () => {
    expect(salesTriggersVerification(0)).toBe(false)
    expect(salesTriggersVerification(499_999)).toBe(false)
  })

  it('triggers at and above the threshold (boundary is inclusive)', () => {
    expect(salesTriggersVerification(500_000)).toBe(true)
    expect(salesTriggersVerification(500_001)).toBe(true)
    expect(salesTriggersVerification(50_000_000)).toBe(true)
  })
})

describe('sellerRequiresIdVerification (risk OR volume)', () => {
  // A risk flag short-circuits: verification is required WITHOUT hitting the DB,
  // so the trailing-volume resolver is never called on the risk path.
  const failingService = {} as unknown as Parameters<typeof sellerRequiresIdVerification>[0]

  it('risk flag forces verification regardless of volume (no DB read)', async () => {
    await expect(
      sellerRequiresIdVerification(failingService, 'seller-1', { riskFlagged: true }),
    ).resolves.toBe(true)
  })
})
