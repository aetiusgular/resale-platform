import { describe, it, expect } from 'vitest'
import { nativeClient, nativeDeepLink } from '@/lib/api/native'
import { isContentSlug, loadContent } from '@/lib/loaders/content'
import { FEE_TIERS, WELCOME_SALES } from '@/lib/fees'

const req = (h: Record<string, string>) => new Request('https://x.test/api/me', { headers: h })

describe('nativeClient (X-Client header)', () => {
  it('parses ios/android with a numeric build', () => {
    expect(nativeClient(req({ 'x-client': 'ios/42' }))).toEqual({ platform: 'ios', build: 42 })
    expect(nativeClient(req({ 'X-Client': 'Android/7' }))).toEqual({ platform: 'android', build: 7 })
  })
  it('returns null for browsers and malformed values', () => {
    expect(nativeClient(req({}))).toBeNull()
    expect(nativeClient(req({ 'x-client': 'web/1' }))).toBeNull()
    expect(nativeClient(req({ 'x-client': 'ios/abc' }))).toBeNull()
    expect(nativeClient(req({ 'x-client': 'ios' }))).toBeNull()
  })
})

describe('nativeDeepLink', () => {
  it('builds archive:// links with an optional query', () => {
    expect(nativeDeepLink('stripe/connect/return', { onboarding: 'complete' })).toBe('archive://stripe/connect/return?onboarding=complete')
    expect(nativeDeepLink('/idv/return')).toBe('archive://idv/return')
  })
})

describe('content loader', () => {
  it('serves exactly the four public documents', () => {
    expect(isContentSlug('terms') && isContentSlug('privacy') && isContentSlug('help') && isContentSlug('fees')).toBe(true)
    expect(isContentSlug('admin')).toBe(false)
  })
  it('fees are structured from the same constants /fees renders (base tier first, welcome ramp)', () => {
    const fees = loadContent('fees')
    if (fees.kind !== 'fees') throw new Error('expected fees')
    expect(fees.buyer_fee_bps).toBe(0)
    expect(fees.tiers.map((t) => t.bps)).toEqual([...FEE_TIERS].reverse().map((t) => t.bps))
    expect(fees.welcome.sales).toBe(WELCOME_SALES)
    expect(fees.shipping.categories.length).toBeGreaterThan(5)
  })
  it('help FAQ carries topics, questions and answers', () => {
    const help = loadContent('help')
    if (help.kind !== 'faq') throw new Error('expected faq')
    expect(help.faqs.length).toBeGreaterThan(5)
    for (const f of help.faqs) expect(f.topic && f.q && f.a).toBeTruthy()
  })
})
