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

/**
 * X-Signature = hex(HMAC_SHA256(request_body, secret)) for the server-to-server
 * `POST /v1/listings` webhook. Matches recs-engine's `expected_body_signature`
 * (telemetry/app.py) — authenticates both the caller and payload integrity.
 * SERVER ONLY — the secret must never reach the browser.
 */
export function bodySignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}
