/**
 * GET /api/orders/by-intent?pi=<payment_intent_id>
 * Polls for the order created after payment_intent.succeeded webhook.
 * Used by the checkout success page to redirect to the order view.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pi = request.nextUrl.searchParams.get('pi')
  if (!pi) return NextResponse.json({ error: 'pi required' }, { status: 400 })

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_payment_intent_id', pi)
    .eq('buyer_id', user.id)
    .single()

  if (!order) return NextResponse.json({ orderId: null })
  return NextResponse.json({ orderId: order.id })
}
