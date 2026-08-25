/**
 * /orders/[id]
 * Order status page — renders buyer view or seller view based on auth.uid().
 */
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import OrderBuyerView from './order-buyer'
import OrderSellerView from './order-seller'
import ReviewPrompt from './review-prompt'
import { REVIEWS_ENABLED } from '@/lib/flags'

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
      shipping_label_url,
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

  // Post-release review prompt (G9). Eligible = a party to a RELEASED order who has
  // not yet reviewed in their direction; the post_review RPC remains authoritative.
  let reviewEligible = false
  if (REVIEWS_ENABLED && order.state === 'released' && (isBuyer || isSeller)) {
    const direction = isBuyer ? 'buyer_to_seller' : 'seller_to_buyer'
    const rsvc = createServiceClientRaw()
    const { data: existingReview } = await rsvc
      .from('reviews')
      .select('id')
      .eq('order_id', order.id)
      .eq('direction', direction)
      .maybeSingle()
    reviewEligible = !existingReview
  }

  // Fetch listing snapshot for display — via service role, NOT the user client:
  // listings RLS only exposes status='active' rows to non-sellers, so the buyer of
  // a sold listing would get null here and the page would render "Unknown"/no photo.
  // Safe: the viewer was verified above to be the buyer, the seller, or an admin.
  const { data: listing } = await createServiceClientRaw()
    .from('listings')
    .select('title, brand, size, images')
    .eq('id', order.listing_id)
    .single()

  if (isSeller) {
    // Fetch buyer stats via service role — buyer_stats is restricted to service_role only
    // to prevent all authenticated users from enumerating each other's dispute histories.
    const serviceClient = createServiceClientRaw()
    const { data: buyerStats } = await serviceClient
      .from('buyer_stats')
      .select('username, purchase_count, dispute_count, member_since')
      .eq('user_id', order.buyer_id)
      .single()

    return (
      <OrderSellerView
        order={order}
        listing={listing ?? { title: 'Unknown', brand: '', size: '', images: [] }}
        buyerStats={buyerStats ?? null}
        reviewPrompt={reviewEligible ? <ReviewPrompt orderId={order.id} counterpartyLabel={buyerStats?.username ?? 'buyer'} /> : null}
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
      reviewPrompt={reviewEligible ? <ReviewPrompt orderId={order.id} counterpartyLabel={sellerProfile?.username ?? 'seller'} /> : null}
    />
  )
}
