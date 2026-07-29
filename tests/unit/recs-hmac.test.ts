import { describe, it, expect } from 'vitest'
import { deviceToken } from '../../lib/recs/hmac'
import { userKeyFor } from '../../lib/recs/keys'

describe('deviceToken (X-Device-Token)', () => {
  it('matches recs-engine expected_device_token (known-answer cross-check)', () => {
    // hex(HMAC_SHA256("device-abc-123", "dev-secret-change-me")), same algorithm
    // as recs-engine telemetry/app.py expected_device_token().
    expect(deviceToken('device-abc-123', 'dev-secret-change-me')).toBe(
      '877812d827d33e36c0b7c27824734b8c5200fc3f26640df3e13a2fea61631ca5',
    )
  })

  it('is a deterministic 64-char lowercase hex digest', () => {
    const t = deviceToken('device-987654', 'secret')
    expect(t).toMatch(/^[0-9a-f]{64}$/)
    expect(deviceToken('device-987654', 'secret')).toBe(t)
  })

  it('changes with both device_id and secret', () => {
    expect(deviceToken('device-a', 's')).not.toBe(deviceToken('device-b', 's'))
    expect(deviceToken('device-a', 's1')).not.toBe(deviceToken('device-a', 's2'))
  })
})

describe('userKeyFor', () => {
  it('u:{user_id} when authenticated, d:{device_id} when anonymous', () => {
    expect(userKeyFor('user-1', 'dev-1')).toBe('u:user-1')
    expect(userKeyFor(null, 'dev-1')).toBe('d:dev-1')
    expect(userKeyFor(undefined, 'dev-1')).toBe('d:dev-1')
  })
})
