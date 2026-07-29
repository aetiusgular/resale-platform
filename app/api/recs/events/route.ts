/**
 * POST /api/recs/events — thin server-side telemetry proxy.
 *
 * The browser batches events and POSTs { deviceId, events } here (never directly
 * to recs-engine). This handler HMAC-signs the batch with the ingest secret
 * SERVER-SIDE (the secret never reaches the client) and forwards to recs-engine
 * `POST /v1/events:batch`.
 *
 * FAIL-SOFT: always returns 202 to the browser so telemetry can never block,
 * error, or slow the UI — a down recs-engine just means events are dropped.
 */
import { NextRequest, NextResponse } from 'next/server'
import { recsConfig, ingestReady } from '@/lib/recs/config'
import { deviceToken } from '@/lib/recs/hmac'

export const dynamic = 'force-dynamic'

const ACCEPTED_NONE = NextResponse.json({ accepted: 0 }, { status: 202 })
const MAX_BATCH = 100 // recs-engine ingest.max_batch_events

export async function POST(request: NextRequest) {
  if (!ingestReady()) return ACCEPTED_NONE

  let body: { deviceId?: unknown; events?: unknown }
  try {
    body = await request.json()
  } catch {
    return ACCEPTED_NONE
  }

  const { deviceId, events } = body
  // recs-engine requires exactly one device_id per batch and a non-empty array.
  if (typeof deviceId !== 'string' || deviceId.length < 8 || !Array.isArray(events) || events.length === 0) {
    return ACCEPTED_NONE
  }
  const batch = events.slice(0, MAX_BATCH)
  const token = deviceToken(deviceId, recsConfig.ingestSecret)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const res = await fetch(`${recsConfig.ingestUrl}/v1/events:batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
      body: JSON.stringify(batch),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return ACCEPTED_NONE
    const data = (await res.json().catch(() => ({}))) as { accepted?: number }
    return NextResponse.json({ accepted: data.accepted ?? batch.length }, { status: 202 })
  } catch {
    return ACCEPTED_NONE // recs-engine unreachable → drop, never surface to UI
  } finally {
    clearTimeout(timer)
  }
}
