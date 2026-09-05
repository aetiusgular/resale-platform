/**
 * POST /api/orders/[id]/receive
 * Buyer marks a `shipped` order as received: shipped → delivered, nothing else.
 *
 * This is the manual-shipping counterpart of the EasyPost delivery scan (webhooks/easypost).
 * It only starts the clocks: delivered_at is stamped by transition_order, so the 3-day
 * auto-release (auto_release_delivered_orders) and the 72h dispute window both begin here.
 * Funds move only on /deliver (buyer confirm) or on auto-release. Idempotent: a second call
 * on a `delivered` order is a no-op 200.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: orderId } = await params
  const service = createServiceClientRaw()

  const { data: order } = await service
    .from('orders')
    .select('id, buyer_id, state')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (order.state === 'delivered') return NextResponse.json({ ok: true, alreadyDelivered: true })
  if (order.state !== 'shipped') {
    return NextResponse.json({ error: `Cannot mark received from state: ${order.state}` }, { status: 422 })
  }

  // transition_order row-locks and re-checks the edge (shipped → delivered), so a
  // concurrent carrier scan or cron sweep cannot double-apply it.
  const { error } = await service.rpc('transition_order', {
    p_order_id:     orderId,
    p_to_state:     'delivered',
    p_source:       'user',
    p_stripe_event: null,
    p_payload:      { received_by: user.id },
  })
  if (error) {
    // Lost a race with the carrier scan or the cron sweep: already delivered is success.
    const { data: fresh } = await service.from('orders').select('state').eq('id', orderId).single()
    if (fresh?.state === 'delivered') return NextResponse.json({ ok: true, alreadyDelivered: true })
    console.error('[receive] transition error:', error)
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
