/**
 * /checkout/[listingId]
 * Server component: verifies auth + listing state, then renders CheckoutClient.
 * Does NOT create the PaymentIntent here — that happens client-side via
 * POST /api/checkout when the user lands on the page (avoids double-lock on SSR).
 * `?offerId=` (accepted offer) is forwarded to the API, which prices from the offer;
 * the client then shows the server's order summary as the source of truth.
 */
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import CheckoutClient from './checkout-client'
import { loadCheckoutPreview } from '@/lib/loaders/checkout'

export const metadata: Metadata = { title: 'Checkout' }

interface PageProps {
  params: Promise<{ listingId: string }>
  searchParams: Promise<{ offerId?: string }>
}

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const [{ listingId }, { offerId }] = await Promise.all([params, searchParams])
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/checkout/preview (native clients).
  const c = await loadCheckoutPreview({ supabase, user, listingId, offerId })
  if (!c) notFound()
  const username = c.viewer.username

  if (c.state === 'unavailable') {
    return (
      <AppShell username={username}>
        <main className="page-main page-main--narrow">
          <div className="empty">
            <div className="empty__title">This listing is no longer available.</div>
            <div className="empty__sub">IT SOLD, OR ANOTHER BUYER IS CHECKING OUT RIGHT NOW</div>
            <div className="empty__cta"><PrefetchLink href="/browse" className="btn-ghost btn-ghost--inline">BROWSE OTHER LISTINGS →</PrefetchLink></div>
          </div>
        </main>
      </AppShell>
    )
  }

  if (c.state === 'own') {
    return (
      <AppShell username={username}>
        <main className="page-main page-main--narrow">
          <div className="empty">
            <div className="empty__title">That one&rsquo;s yours.</div>
            <div className="empty__sub">YOU CAN&rsquo;T BUY YOUR OWN LISTING</div>
            <div className="empty__cta"><PrefetchLink href="/sell" className="btn-ghost btn-ghost--inline">MANAGE IN SELL →</PrefetchLink></div>
          </div>
        </main>
      </AppShell>
    )
  }

  const preview = c.preview!
  return (
    <AppShell username={username}>
      <CheckoutClient
        listingId={listingId}
        offerId={c.offer_id}
        listing={{ title: c.listing.title, brand: c.listing.brand, size: c.listing.size, image: c.listing.image }}
        preview={{ item_cents: preview.item_cents, shipping_cents: preview.shipping_cents, total_cents: preview.total_cents }}
        savedAddress={c.saved_address}
        shipping={c.shipping}
      />
    </AppShell>
  )
}
