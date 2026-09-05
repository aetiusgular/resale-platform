/**
 * /orders/[id]
 * Order status page — renders buyer view or seller view based on auth.uid().
 */
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrderBuyerView from './order-buyer'
import OrderSellerView from './order-seller'
import ReviewPrompt from './review-prompt'
import { loadOrderDetail } from '@/lib/loaders/order'
import AppShell from '@/app/components/app-shell'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/orders/[id] (native clients). null = not
  // found, or the viewer is neither a party nor an admin → 404, as before.
  const d = await loadOrderDetail({ supabase, user, id })
  if (!d) notFound()

  const { order, listing, review_eligible: reviewEligible, buyer_stats: buyerStats } = d
  const viewerUsername = d.viewer.username

  if (d.role === 'seller') {
    return (
      <AppShell username={viewerUsername}>
        <OrderSellerView
          order={order}
          listing={listing}
          buyerStats={buyerStats}
          reviewPrompt={reviewEligible ? <ReviewPrompt orderId={order.id} counterpartyLabel={buyerStats?.username ?? 'buyer'} /> : null}
        />
      </AppShell>
    )
  }

  const sellerUsername = d.seller_username ?? 'seller'
  return (
    <AppShell username={viewerUsername}>
      <OrderBuyerView
        order={order}
        listing={listing}
        sellerUsername={sellerUsername}
        reviewPrompt={reviewEligible ? <ReviewPrompt orderId={order.id} counterpartyLabel={sellerUsername} /> : null}
      />
    </AppShell>
  )
}
