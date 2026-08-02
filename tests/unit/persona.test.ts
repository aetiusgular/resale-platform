import { describe, it, expect, afterEach } from 'vitest'
import crypto from 'node:crypto'
import {
  verifyPersonaSignature,
  parsePersonaEvent,
  personaHostedUrl,
  personaConfigured,
  isApproval,
  isDecline,
} from '../../lib/idv/persona'

const SECRET = 'wbhsec_test_123'
const sign = (t: string, body: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')

describe('verifyPersonaSignature', () => {
  const body = '{"data":{"id":"evt_1"}}'
  const t = '1700000000'

  it('accepts a correctly signed body', () => {
    expect(verifyPersonaSignature(body, `t=${t},v1=${sign(t, body)}`, SECRET)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyPersonaSignature(body + 'x', `t=${t},v1=${sign(t, body)}`, SECRET)).toBe(false)
  })
  it('rejects the wrong secret', () => {
    expect(verifyPersonaSignature(body, `t=${t},v1=${sign(t, body, 'other')}`, SECRET)).toBe(false)
  })
  it('rejects missing header or secret', () => {
    expect(verifyPersonaSignature(body, null, SECRET)).toBe(false)
    expect(verifyPersonaSignature(body, `t=${t},v1=${sign(t, body)}`, undefined)).toBe(false)
  })
  it('accepts during secret rotation (one of two space-separated sets matches)', () => {
    const good = `t=${t},v1=${sign(t, body)}`
    const stale = `t=${t},v1=${'0'.repeat(64)}`
    expect(verifyPersonaSignature(body, `${stale} ${good}`, SECRET)).toBe(true)
  })
  it('rejects a malformed header', () => {
    expect(verifyPersonaSignature(body, 'garbage', SECRET)).toBe(false)
  })
})

describe('parsePersonaEvent', () => {
  const payload = {
    data: {
      id: 'evt_abc',
      attributes: {
        name: 'inquiry.approved',
        payload: { data: { id: 'inq_xyz', type: 'inquiry', attributes: { 'reference-id': 'user-123', status: 'approved' } } },
      },
    },
  }
  it('extracts event id/name + inquiry id/reference-id/status', () => {
    expect(parsePersonaEvent(payload)).toEqual({ eventId: 'evt_abc', eventName: 'inquiry.approved', inquiryId: 'inq_xyz', referenceId: 'user-123', status: 'approved' })
  })
  it('returns nulls for a shapeless body', () => {
    expect(parsePersonaEvent({})).toEqual({ eventId: null, eventName: null, inquiryId: null, referenceId: null, status: null })
    expect(parsePersonaEvent(null)).toEqual({ eventId: null, eventName: null, inquiryId: null, referenceId: null, status: null })
  })
  it('classifies approval and decline', () => {
    expect(isApproval(parsePersonaEvent(payload))).toBe(true)
    const declined = parsePersonaEvent({ data: { id: 'e', attributes: { name: 'inquiry.declined', payload: { data: { attributes: { status: 'declined' } } } } } })
    expect(isDecline(declined)).toBe(true)
    expect(isApproval(declined)).toBe(false)
  })
})

describe('personaHostedUrl', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved } })
  it('returns null when unconfigured', () => {
    delete process.env.PERSONA_TEMPLATE_ID
    expect(personaConfigured()).toBe(false)
    expect(personaHostedUrl('user-1')).toBeNull()
  })
  it('builds a hosted URL with template + reference-id when configured', () => {
    process.env.PERSONA_TEMPLATE_ID = 'itmpl_123'
    process.env.PERSONA_ENVIRONMENT_ID = 'env_sandbox'
    delete process.env.PERSONA_REDIRECT_URI
    delete process.env.NEXT_PUBLIC_APP_URL
    const url = personaHostedUrl('user-1')!
    expect(url.startsWith('https://withpersona.com/verify?')).toBe(true)
    expect(url).toContain('inquiry-template-id=itmpl_123')
    expect(url).toContain('environment-id=env_sandbox')
    expect(url).toContain('reference-id=user-1')
    expect(personaConfigured()).toBe(true)
  })
})
