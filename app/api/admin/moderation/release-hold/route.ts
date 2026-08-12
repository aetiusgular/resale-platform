/**
 * POST /api/admin/moderation/release-hold { target_type:'order', target_id, reason? }
 *
 * Clears a collusion PAYOUT hold (Branch 4 / L2) and pays the seller. A held order sits
 * in 'released' state with transfer_hold_reason set and no stripe_transfer_id — the funds
 * are still in escrow. This issues the Stripe transfer (mirroring the deliver/cron money
 * path), stamps stripe_transfer_id (so the cron never re-holds it), resolves the
 * collusion_flags row, and logs one moderation_actions audit row. Admin-only.
 *
 * This is the "cleared — pay the seller" resolution. Refund/clawback for CONFIRMED
 * collusion is a separate flow (needs a released→refunded escrow-refund edge). code-
 * reviewer: money path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { applyTierProgress } from '@/lib/tier-progress'
import { issueBuyerRewards } from '@/lib/rewards'
import { checkEliteEligibility } from '@/lib/seller-program'
import { BUYER_REWARDS_ENABLED } from '@/lib/flags'
import { checkReleasable } from '@/lib/trust/release-hold'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { target_type?: unknown; target_id?: unknown; reason?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.target_type !== 'order') {
    return NextResponse.json({ error: "release-hold supports target_type 'order'" }, { status: 400 })
  }
  if (typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id (string) required' }, { status: 400 })
  }
  const orderId = body.target_id
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Payout hold released by moderator'

  const service = createServiceClientRaw()
  const { data: order } = await service
    .from('orders')
    .select('id, buyer_id, seller_id, state, transfer_cents, stripe_transfer_id, transfer_hold_reason')
    .eq('id', orderId)
    .single()

  const gate = checkReleasable(order)
  if (!gate.ok) return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status })

  const { data: seller } = await service
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', order!.seller_id)
    .single()
  if (!seller?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Seller payout account not found', code: 'no_connect' }, { status: 422 })
  }

  // Issue the transfer FIRST; only stamp the order once Stripe confirms (no phantom payout).
  let transferId: string
  try {
    const transfer = await stripe.transfers.create({
      amount:      order!.transfer_cents,
      currency:    'usd',
      destination: seller.stripe_connect_account_id,
      description: `Order ${orderId} — payout hold released`,
      metadata:    { order_id: orderId, released_by: user.id, via: 'moderation' },
    })
    transferId = transfer.id
  } catch (stripeError) {
    console.error('[moderation/release-hold] Stripe transfer error:', stripeError)
    return NextResponse.json({ error: 'Transfer failed — the hold stands. Try again.', code: 'transfer_failed' }, { status: 502 })
  }

  // Clear the hold + record the transfer; resolve the flag so it leaves the queue.
  await service.from('orders').update({ stripe_transfer_id: transferId, transfer_hold_reason: null }).eq('id', orderId)
  await service.from('collusion_flags').update({ resolved_at: new Date().toISOString() }).eq('order_id', orderId)

  // Tier progress already applied at release; idempotent, mirror the cron for parity.
  await Promise.all([
    applyTierProgress(service, order!.buyer_id, 'buyer'),
    applyTierProgress(service, order!.seller_id, 'seller'),
  ])
  // Fee Model v3: grant buyer milestone rewards + check elite-seller threshold (fail-soft).
  await Promise.all([
    BUYER_REWARDS_ENABLED ? issueBuyerRewards(service, order!.buyer_id) : Promise.resolve([]),
    checkEliteEligibility(service, order!.seller_id),
  ])

  const { data: actionId, error: logErr } = await supabase.rpc('record_moderation_action', {
    p_target_type: 'order',
    p_target_id: orderId,
    p_action: 'release_hold',
    p_reason: reason,
    p_evidence: { transfer_id: transferId },
  })
  if (logErr) console.error('[moderation/release-hold] audit log error:', logErr)

  return NextResponse.json({ ok: true, transferId, action_id: actionId ?? null })
}
