/**
 * /orders/[id]
 * Order status page — renders buyer view or seller view based on auth.uid().
 */
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrderBuyerView from './order-buyer'
import OrderSellerView from './order-seller'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Fetch order — RLS ensures only buyer or seller can see it
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id,
      listing_id,
      buyer_id,
      seller_id,
      state,
      item_cents,
      buyer_fee_cents,
      seller_fee_cents,
      shipping_cents,
      total_cents,
      transfer_cents,
      carrier,
      tracking_number,
      shipping_address,
      stripe_transfer_id,
      paid_at,
      seller_confirmed_at,
      shipped_at,
      delivered_at,
      released_at,
      disputed_at,
      refunded_at,
      cancelled_at,
      created_at
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  // Determine role
  const isBuyer  = order.buyer_id  === user.id
  const isSeller = order.seller_id === user.id

  if (!isBuyer && !isSeller) {
    // Admin check — admin can view any order
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') notFound()
  }

  // Fetch listing snapshot for display
  const { data: listing } = await supabase
    .from('listings')
    .select('title, brand, size, images')
    .eq('id', order.listing_id)
    .single()

  if (isSeller) {
    // Fetch buyer stats for the seller view
    const { data: buyerStats } = await supabase
      .from('buyer_stats')
      .select('username, purchase_count, dispute_count, member_since')
      .eq('user_id', order.buyer_id)
      .single()

    return (
      <OrderSellerView
        order={order}
        listing={listing ?? { title: 'Unknown', brand: '', size: '', images: [] }}
        buyerStats={buyerStats ?? null}
      />
    )
  }

  // Fetch seller info for buyer view
  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', order.seller_id)
    .single()

  return (
    <OrderBuyerView
      order={order}
      listing={listing ?? { title: 'Unknown', brand: '', size: '', images: [] }}
      sellerUsername={sellerProfile?.username ?? 'seller'}
    />
  )
}
