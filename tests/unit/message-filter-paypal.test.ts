import { describe, it, expect } from 'vitest'
import { filterMessage, REDACTION_BODY } from '@/lib/message-filter'

describe('filterMessage — paypal.com/send (B8 fix)', () => {
  it('redacts paypal.com/send shortlinks', () => {
    const r = filterMessage('send money here paypal.com/send/username')
    expect(r.redacted).toBe(true)
    expect(r.body).toBe(REDACTION_BODY)
  })

  it('redacts paypal.com/send with query params', () => {
    const r = filterMessage('paypal.com/send?amount=100&receiver=test@example.com')
    expect(r.redacted).toBe(true)
  })

  it('does not redact plain paypal.com domain mention', () => {
    // "paypal.com" alone (no /send path) should not be caught by this specific pattern,
    // but the generic https:// URL detector will catch it if a full URL is given.
    // Bare "paypal.com" without scheme or /send is NOT caught — accepted tradeoff.
    const r = filterMessage('they only accept paypal.com payments (platform escrow)')
    // This would NOT be caught by paypal.com/send pattern but might be caught by www. pattern
    // Checking the specific paypal.com/send fix — bare domain without /send is accepted.
    expect(r.redacted).toBe(false)
  })
})
