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
import { orderAmountsAt } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { createServiceClientRaw } from '@/lib/supabase/service'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import CheckoutClient from './checkout-client'

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

  // Fetch the listing (visible if active OR pending_escrow for the current buyer)
  const [{ data: listing }, { data: profile }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, brand, category, size, price_cents, shipping_cents, images, seller_id, status')
      .eq('id', listingId)
      .single(),
    supabase.from('profiles').select('username, shipping_address').eq('id', user.id).single(),
  ])

  if (!listing) notFound()
  const username = (profile?.username as string) ?? ''

  if (listing.status !== 'active') {
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

  if (listing.seller_id === user.id) {
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

  const service = createServiceClientRaw()
  // Fee Model v3: buyers pay no platform fee; only the seller rate is tiered.
  const sellerBps = await resolveEffectiveBps(service, listing.seller_id, 'seller')
  // Preview only — the API's orderSummary (server-computed, offer-aware) replaces this on mount.
  const preview = orderAmountsAt(listing.price_cents, sellerBps, listing.shipping_cents ?? floorShippingCents(listing.category))
  const image = (listing.images as string[])?.find(Boolean) ?? null

  return (
    <AppShell username={username}>
      <CheckoutClient
        listingId={listingId}
        offerId={typeof offerId === 'string' && /^[0-9a-f-]{36}$/i.test(offerId) ? offerId : null}
        listing={{ title: listing.title, brand: listing.brand, size: listing.size, image }}
        preview={{ item_cents: preview.item_cents, shipping_cents: preview.shipping_cents, total_cents: preview.total_cents }}
        savedAddress={profile?.shipping_address as Record<string, string> | null}
      />
    </AppShell>
  )
}
