import { createHmac } from 'node:crypto'

/**
 * X-Device-Token = hex(HMAC_SHA256(device_id, secret)).
 * Matches recs-engine's `expected_device_token` (telemetry/app.py).
 * SERVER ONLY — the secret must never reach the browser. Called from the
 * /api/recs/events route handler, never from client code.
 */
export function deviceToken(deviceId: string, secret: string): string {
  return createHmac('sha256', secret).update(deviceId).digest('hex')
}
