import { describe, it, expect } from 'vitest'
import { lintListing } from '../../lib/antislop-lint'

describe('lintListing — clean listings', () => {
  it('single brand in title, no desc stuffing → passes', () => {
    const violations = lintListing('SUPREME BOX LOGO HOODIE', 'Great condition, barely worn.')
    expect(violations).toHaveLength(0)
  })

  it('two brands in title (at limit) → passes', () => {
    const violations = lintListing('NIKE X PALACE TRACK JACKET', 'Clean piece.')
    expect(violations).toHaveLength(0)
  })

  it('four brands in description (at limit) → passes', () => {
    const desc = 'Inspired by SUPREME, PALACE, BAPE, and STUSSY but none of these.'
    const violations = lintListing('JACKET', desc)
    expect(violations).toHaveLength(0)
  })

  it('empty description → passes', () => {
    const violations = lintListing('RICK OWENS DRKSHDW JACKET', '')
    expect(violations).toHaveLength(0)
  })
})

describe('lintListing — blocked patterns (hard reject)', () => {
  it('"dm me" → reject', () => {
    const v = lintListing('JACKET', 'Brand new, dm me for more info!')
    const rejects = v.filter(x => x.severity === 'reject')
    expect(rejects).toHaveLength(1)
    expect(rejects[0].code).toBe('blocked_pattern')
  })

  it('"paypal f&f" → reject', () => {
    const v = lintListing('HOODIE', 'Accept paypal f&f only')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('"paypal friends and family" → reject', () => {
    const v = lintListing('PANTS', 'prefer paypal friends and family')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('"telegram" → reject', () => {
    const v = lintListing('JACKET', 'Contact me on telegram')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('"whatsapp" → reject', () => {
    const v = lintListing('BAG', 'Reach me on whatsapp')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('"venmo" → reject', () => {
    const v = lintListing('SHOES', 'Venmo accepted')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('"cash app" → reject', () => {
    const v = lintListing('CAP', 'Cash app ok')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('blocked pattern in title → reject', () => {
    const v = lintListing('DM ME FOR DETAILS', 'Great piece')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })

  it('blocked pattern is case-insensitive', () => {
    const v = lintListing('JACKET', 'DM Me please')
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })
})

describe('lintListing — brand stuffing (warn)', () => {
  it('3 brands in title → warn (brand_stuffing_title)', () => {
    const v = lintListing('SUPREME GUCCI PRADA HOODIE', 'Beautiful piece.')
    const warns = v.filter(x => x.severity === 'warn' && x.code === 'brand_stuffing_title')
    expect(warns).toHaveLength(1)
    expect(warns[0].message).toContain('3')
  })

  it('5 brands in description → warn (brand_stuffing_desc)', () => {
    const desc = 'Inspired by SUPREME, PALACE, BAPE, STUSSY, and GUCCI aesthetics'
    const v = lintListing('HOODIE', desc)
    const warns = v.filter(x => x.severity === 'warn' && x.code === 'brand_stuffing_desc')
    expect(warns).toHaveLength(1)
  })

  it('brand stuffing does NOT produce reject, only warn', () => {
    const v = lintListing('SUPREME GUCCI PRADA DIOR CHANEL JACKET', 'Many brands listed')
    expect(v.some(x => x.severity === 'reject')).toBe(false)
    expect(v.some(x => x.severity === 'warn')).toBe(true)
  })

  it('blocked pattern + brand stuffing → both violations returned, reject present', () => {
    const v = lintListing(
      'SUPREME GUCCI PRADA HOODIE',
      'dm me for details — BAPE STUSSY PALACE KITH',
    )
    expect(v.some(x => x.severity === 'reject')).toBe(true)
  })
})
