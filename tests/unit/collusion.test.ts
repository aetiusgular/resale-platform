import { describe, it, expect } from 'vitest'
import { evaluateCollusion, collusionFlagged } from '../../lib/trust/collusion'

describe('evaluateCollusion', () => {
  it('clean arm\'s-length trade ⇒ not flagged', () => {
    const r = evaluateCollusion(
      { cardFingerprints: ['cardA'], bankFingerprints: ['bankA'], billingName: 'Alice B', billingZip: '10001', addresses: ['1 a st, ny'] },
      { cardFingerprints: ['cardB'], bankFingerprints: ['bankB'], billingName: 'Bob C', billingZip: '90001', addresses: ['2 b st, la'] },
    )
    expect(r.flagged).toBe(false)
    expect(r.reasons).toEqual([])
  })

  it('shared bank fingerprint ⇒ shared_bank', () => {
    expect(evaluateCollusion({ bankFingerprints: ['bankX'] }, { bankFingerprints: ['bankX'] }).reasons).toContain('shared_bank')
  })

  it('shared card fingerprint ⇒ shared_card', () => {
    expect(evaluateCollusion({ cardFingerprints: ['fpZ', 'fpY'] }, { cardFingerprints: ['fpY'] }).reasons).toContain('shared_card')
  })

  it('shared billing identity needs BOTH name and zip', () => {
    expect(evaluateCollusion({ billingName: 'Sam Tan', billingZip: '10001' }, { billingName: 'sam  tan', billingZip: '10001' }).reasons).toContain('shared_billing_identity')
    expect(evaluateCollusion({ billingName: 'Sam Tan', billingZip: '10001' }, { billingName: 'Sam Tan', billingZip: '99999' }).reasons).not.toContain('shared_billing_identity')
    expect(evaluateCollusion({ billingName: '', billingZip: '' }, { billingName: '', billingZip: '' }).reasons).not.toContain('shared_billing_identity')
  })

  it('ship-to-self: buyer ships to seller\'s origin address', () => {
    const r = evaluateCollusion({ addresses: ['500 Main St, Reno NV 89501'] }, { addresses: ['500  main st, reno nv 89501'] })
    expect(r.reasons).toContain('ship_to_self')
  })

  it('multiple signals accumulate; collusionFlagged mirrors flagged', () => {
    const buyer = { bankFingerprints: ['b'], cardFingerprints: ['c'] }
    const seller = { bankFingerprints: ['b'], cardFingerprints: ['c'] }
    const r = evaluateCollusion(buyer, seller)
    expect(r.reasons.sort()).toEqual(['shared_bank', 'shared_card'])
    expect(collusionFlagged(buyer, seller)).toBe(true)
  })

  it('empty signals never flag', () => {
    expect(collusionFlagged({}, {})).toBe(false)
  })
})
