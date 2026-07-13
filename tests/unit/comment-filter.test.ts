import { describe, it, expect } from 'vitest'
import { filterComment } from '@/lib/comment-filter'
import { REDACTION_BODY } from '@/lib/message-filter'

describe('filterComment', () => {
  it('passes clean comment bodies unchanged', () => {
    const r = filterComment('seams and bar tacks match my 2004 run. zipper pull font is right.')
    expect(r.redacted).toBe(false)
    expect(r.body).toBe('seams and bar tacks match my 2004 run. zipper pull font is right.')
  })

  it('redacts cashapp handle in comment', () => {
    const r = filterComment('is this still available? i can pay directly at cash.app/$user8841')
    expect(r.redacted).toBe(true)
    expect(r.body).toBe(REDACTION_BODY)
  })

  it('redacts http URLs in comment', () => {
    const r = filterComment('pay here https://grail-pay.example/8841')
    expect(r.redacted).toBe(true)
    expect(r.body).toBe(REDACTION_BODY)
  })

  it('redacts paypal.me in comment', () => {
    const r = filterComment('paypal.me/seller123')
    expect(r.redacted).toBe(true)
    expect(r.body).toBe(REDACTION_BODY)
  })

  it('redacts venmo mention in comment', () => {
    const r = filterComment('my venmo is @archiveseller')
    expect(r.redacted).toBe(true)
    expect(r.body).toBe(REDACTION_BODY)
  })

  it('does not redact authentication discussion', () => {
    const r = filterComment('tag stitching consistent with the era. would buy.')
    expect(r.redacted).toBe(false)
  })

  it('does not redact measurement questions', () => {
    const r = filterComment('measurements pit to pit?')
    expect(r.redacted).toBe(false)
  })

  it('redacts www. URLs', () => {
    const r = filterComment('contact me at www.paypal.com/send/user')
    expect(r.redacted).toBe(true)
  })
})
