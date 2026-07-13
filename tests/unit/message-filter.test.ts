import { describe, it, expect } from 'vitest'
import { filterMessage, REDACTION_BODY } from '@/lib/message-filter'

describe('filterMessage', () => {
  it('passes clean messages unchanged', () => {
    const result = filterMessage('would you take $1,000? can pay right away.')
    expect(result.redacted).toBe(false)
    expect(result.body).toBe('would you take $1,000? can pay right away.')
  })

  it('redacts http URLs', () => {
    const result = filterMessage('pay me here: https://paypal.com/pay/123')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts paypal.me links', () => {
    const result = filterMessage('send to paypal.me/username please')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts venmo handles', () => {
    const result = filterMessage('my venmo is @user')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts cashapp', () => {
    const result = filterMessage('use cash.app/$user')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts telegram mentions', () => {
    const result = filterMessage('message me on telegram')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts whatsapp mentions', () => {
    const result = filterMessage('whatsapp me at +1234')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts zelle mentions', () => {
    const result = filterMessage('I can zelle you')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('redacts t.me links', () => {
    const result = filterMessage('contact me at t.me/user')
    expect(result.redacted).toBe(true)
    expect(result.body).toBe(REDACTION_BODY)
  })

  it('does not redact bare dollar amounts', () => {
    const result = filterMessage('$1,100 and it ships tomorrow.')
    expect(result.redacted).toBe(false)
  })

  it('does not redact email-like strings without URL scheme', () => {
    const result = filterMessage('my name is john')
    expect(result.redacted).toBe(false)
  })
})
