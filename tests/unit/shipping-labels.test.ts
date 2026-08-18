import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  pickCheapestGroundRate,
  labelMarginCents,
  parcelFromPreset,
  parseTrackerEvent,
  verifyEasypostSignature,
} from '../../lib/shipping-labels'

describe('pickCheapestGroundRate', () => {
  it('returns null for empty / missing', () => {
    expect(pickCheapestGroundRate(null)).toBeNull()
    expect(pickCheapestGroundRate(undefined)).toBeNull()
    expect(pickCheapestGroundRate([])).toBeNull()
  })
  it('picks the cheapest enabled-ground rate with its id', () => {
    const rates = [
      { id: 'r1', service: 'GroundAdvantage', rate: '8.42' },
      { id: 'r2', service: 'UPSGround', rate: '7.15' },
      { id: 'r3', service: 'Priority', rate: '5.10' }, // not ground → ignored
    ]
    expect(pickCheapestGroundRate(rates)).toEqual({ id: 'r2', cents: 715 })
  })
  it('ignores rates missing an id or non-positive', () => {
    const rates = [
      { service: 'GroundAdvantage', rate: '4.00' }, // no id
      { id: 'r2', service: 'UPSGround', rate: '0' },
      { id: 'r3', service: 'Ground', rate: '11.99' },
    ]
    expect(pickCheapestGroundRate(rates)).toEqual({ id: 'r3', cents: 1199 })
  })
  it('returns null when no ground service present', () => {
    expect(pickCheapestGroundRate([{ id: 'r1', service: 'Express', rate: '3.00' }])).toBeNull()
  })
})

describe('labelMarginCents', () => {
  it('collected minus cost (positive margin)', () => {
    expect(labelMarginCents(900, 642)).toBe(258)
  })
  it('can be negative (platform eats overage)', () => {
    expect(labelMarginCents(900, 1400)).toBe(-500)
  })
  it('rounds inputs to integer cents', () => {
    expect(labelMarginCents(900.4, 642.6)).toBe(900 - 643)
  })
})

describe('parcelFromPreset', () => {
  it('maps preset oz/inches to an EasyPost parcel', () => {
    const preset = { weightOz: 80, lengthIn: 15, widthIn: 11, heightIn: 7, floorCents: 2000 }
    expect(parcelFromPreset(preset)).toEqual({ weight: 80, length: 15, width: 11, height: 7 })
  })
})

describe('parseTrackerEvent', () => {
  it('pulls id / tracking / status', () => {
    const ev = { id: 'evt_1', result: { tracking_code: '1Z999', status: 'in_transit' } }
    expect(parseTrackerEvent(ev)).toEqual({
      eventId: 'evt_1', trackingCode: '1Z999', status: 'in_transit', deliveredAt: null,
    })
  })
  it('extracts a delivered timestamp from the last tracking detail', () => {
    const ev = {
      id: 'evt_2',
      result: {
        tracking_code: '1Z999', status: 'delivered', updated_at: '2026-08-20T00:00:00Z',
        tracking_details: [
          { status: 'in_transit', datetime: '2026-08-19T10:00:00Z' },
          { status: 'delivered', datetime: '2026-08-20T14:30:00Z' },
        ],
      },
    }
    const parsed = parseTrackerEvent(ev)
    expect(parsed.status).toBe('delivered')
    expect(parsed.deliveredAt).toBe('2026-08-20T14:30:00Z')
  })
  it('falls back to updated_at when delivered but no detail datetime', () => {
    const ev = { id: 'e', result: { status: 'delivered', updated_at: '2026-08-21T00:00:00Z', tracking_details: [] } }
    expect(parseTrackerEvent(ev).deliveredAt).toBe('2026-08-21T00:00:00Z')
  })
  it('is null-safe on garbage', () => {
    expect(parseTrackerEvent(null)).toEqual({ eventId: null, trackingCode: null, status: null, deliveredAt: null })
  })
})

describe('verifyEasypostSignature', () => {
  const secret = 'whsec_ep_test'
  const body = JSON.stringify({ id: 'evt', result: { status: 'delivered' } })
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')

  it('accepts a valid signature (bare hex)', () => {
    expect(verifyEasypostSignature(body, digest, secret)).toBe(true)
  })
  it('accepts a valid signature with the hmac-sha256-hex= prefix', () => {
    expect(verifyEasypostSignature(body, `hmac-sha256-hex=${digest}`, secret)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyEasypostSignature(body + 'x', digest, secret)).toBe(false)
  })
  it('rejects a wrong secret', () => {
    expect(verifyEasypostSignature(body, digest, 'nope')).toBe(false)
  })
  it('rejects missing header / secret', () => {
    expect(verifyEasypostSignature(body, null, secret)).toBe(false)
    expect(verifyEasypostSignature(body, digest, undefined)).toBe(false)
  })
})
