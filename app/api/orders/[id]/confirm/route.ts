/**
 * POST /api/orders/[id]/confirm
 * Seller confirms the order (paid_held → seller_confirmed).
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { buyLabelForOrder } from '@/lib/fulfillment'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: orderId } = await params
  const service = createServiceClientRaw()

  // Verify caller is the seller
  const { data: order } = await service
    .from('orders')
    .select('seller_id, state')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.seller_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await service.rpc('transition_order', {
    p_order_id:     orderId,
    p_to_state:     'seller_confirmed',
    p_source:       'user',
    p_stripe_event: null,
    p_payload:      { confirmed_by: user.id },
  })

  if (error) {
    console.error('[confirm] transition error:', error)
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  // G12: auto-buy a prepaid label for the confirmed sale (dormant + fail-soft; never blocks).
  if (SHIPPING_LABELS_ENABLED) after(() => buyLabelForOrder(service, orderId))

  return NextResponse.json({ ok: true })
}
