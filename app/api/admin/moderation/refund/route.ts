/**
 * POST /api/admin/moderation/refund { target_type:'order', target_id, reason? }
 *
 * Moderator refund (G6). Routes through the SAME money path as dispute resolution
 * (Stripe refund + transition_order state machine) and NEVER mutates amounts. Works on
 * any order whose funds are still in escrow (pre-release) via the admin-source refund
 * edge added in migration 0024; a 'released' order is rejected (that is a clawback, a
 * separate flow). Writes one moderation_actions audit row. code-reviewer: money path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.target_type !== 'order') {
    return NextResponse.json({ error: "refund supports target_type 'order'" }, { status: 400 })
  }
  if (typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  const orderId = body.target_id
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Refunded by moderator'

  const service = createServiceClientRaw()
  const { data: order } = await service
    .from('orders')
    .select('id, state, listing_id, stripe_payment_intent_id')
    .eq('id', orderId)
    .single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (['released', 'refunded', 'cancelled'].includes(order.state)) {
    return NextResponse.json(
      { error: `Cannot refund an order in state '${order.state}' (released funds require a clawback).`, code: 'not_refundable' },
      { status: 422 },
    )
  }

  // Prevent a double refund if Stripe already has one for this payment intent.
  const existingRefunds = await stripe.refunds.list({ payment_intent: order.stripe_payment_intent_id, limit: 1 })

  // DB state first (the charge.refunded webhook is idempotent), then Stripe.
  const { error: transitionError } = await service.rpc('transition_order', {
    p_order_id: orderId,
    p_to_state: 'refunded',
    p_source: 'admin',
    p_stripe_event: null,
    p_payload: { refunded_by: user.id, reason, via: 'moderation' },
  })
  if (transitionError) {
    return NextResponse.json({ error: transitionError.message, code: 'illegal_transition' }, { status: 422 })
  }

  // Void the listing (mirrors the dispute-resolution refund path).
  await service.from('listings').update({ status: 'removed', rejection_reason: reason }).eq('id', order.listing_id)

  let refundPending = false
  if (existingRefunds.data.length === 0) {
    try {
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        metadata: { order_id: orderId, refunded_by: user.id, via: 'moderation' },
      })
    } catch (stripeError) {
      console.error('[moderation/refund] Stripe refund error after DB transition:', stripeError)
      refundPending = true
    }
  }

  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'order',
    p_target_id: orderId,
    p_action: 'refund',
    p_reason: reason,
    p_evidence: { refund_pending: refundPending },
  })
  if (logErr) console.error('[moderation/refund] audit log error:', logErr)

  return NextResponse.json({ ok: true, action_id: actionId ?? null, refundPending })
}
