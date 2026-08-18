/**
 * POST /api/webhooks/easypost — EasyPost tracker webhook (G12).
 * Verifies the HMAC signature over the RAW body, records the event idempotently, and on a
 * `delivered` status transitions the matching order shipped → delivered (which starts the
 * existing 3-day auto-release clock). Escrow RELEASE is unchanged — buyer-confirm or the cron.
 * Behind SHIPPING_LABELS_ENABLED. Auth-critical: verify signature BEFORE trusting anything.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { verifyEasypostSignature, parseTrackerEvent } from '@/lib/shipping-labels'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!SHIPPING_LABELS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = await req.text()
  if (!verifyEasypostSignature(raw, req.headers.get('X-Hmac-Signature'), process.env.EASYPOST_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const ev = parseTrackerEvent(body)
  if (!ev.eventId) return NextResponse.json({ ok: true }) // nothing actionable

  const service = createServiceClientRaw()

  // Idempotency: one row per provider event. Replay hits the UNIQUE and no-ops.
  const { error: logErr } = await service.from('shipping_events').insert({
    provider: 'easypost',
    event_id: ev.eventId,
    event_name: (body as { description?: string })?.description ?? 'tracker.updated',
    tracking_code: ev.trackingCode,
    status: ev.status,
    payload: body as Record<string, unknown>,
  })
  if (logErr) {
    if (logErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    console.error('[easypost] event log error:', logErr)
    return NextResponse.json({ error: 'record failed' }, { status: 500 }) // let EasyPost retry
  }

  // On delivered: advance the matching shipped order to delivered (starts auto-release clock).
  if (ev.status === 'delivered' && ev.trackingCode) {
    const { data: order } = await service
      .from('orders')
      .select('id, state')
      .eq('tracking_number', ev.trackingCode)
      .maybeSingle()
    if (order && order.state === 'shipped') {
      await service.rpc('transition_order', {
        p_order_id: order.id,
        p_to_state: 'delivered',
        p_source: 'webhook',
        p_stripe_event: null,
        p_payload: { via: 'easypost_tracker', delivered_at: ev.deliveredAt },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
