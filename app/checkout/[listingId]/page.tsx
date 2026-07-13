/**
 * /checkout/[listingId]
 * Server component: verifies auth + listing state, then renders CheckoutClient.
 * Does NOT create the PaymentIntent here — that happens client-side via
 * POST /api/checkout when the user lands on the page (avoids double-lock on SSR).
 */
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCents, orderAmounts } from '@/lib/fees'
import CheckoutClient from './checkout-client'

interface PageProps {
  params: Promise<{ listingId: string }>
}

export default async function CheckoutPage({ params }: PageProps) {
  const { listingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Fetch the listing (visible if active OR pending_escrow for the current buyer)
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, brand, category, size, price_cents, images, seller_id, status')
    .eq('id', listingId)
    .single()

  if (!listing) notFound()

  if (listing.status !== 'active') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)', marginBottom: 16 }}>
            THIS LISTING IS NO LONGER AVAILABLE
          </div>
          <Link href="/browse" style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Browse other listings
          </Link>
        </div>
      </div>
    )
  }

  if (listing.seller_id === user.id) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink-soft)' }}>
            Cannot purchase your own listing.
          </div>
        </div>
      </div>
    )
  }

  // Prefetch buyer's shipping address
  const { data: profile } = await supabase
    .from('profiles')
    .select('shipping_address')
    .eq('id', user.id)
    .single()

  const amounts = orderAmounts(listing.price_cents)
  const image = (listing.images as string[])?.find(Boolean) ?? null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Minimal header */}
      <header style={{
        height: 64,
        borderBottom: '1px solid var(--color-line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 80px',
      }}>
        <span style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>
          ———
        </span>
        <span style={{ font: '600 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
          Checkout
        </span>
        <Link href={`/listings/${listingId}`} style={{
          font: '500 11px var(--font-ui)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-soft)',
          textDecoration: 'none',
        }}>
          Back to listing
        </Link>
      </header>

      {/* Two-column layout: order summary | payment form */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '48px 24px 96px',
        display: 'grid',
        gridTemplateColumns: 'min(400px, 100%) 1fr',
        gap: 64,
        alignItems: 'start',
      }}>
        {/* Left: Order summary (static, server-rendered) */}
        <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
            Order
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 16 }}>
            {image ? (
              <img
                src={image}
                alt={listing.title}
                style={{ flex: 'none', width: 72, aspectRatio: '3/4', objectFit: 'cover', border: '1px solid var(--color-line)' }}
              />
            ) : (
              <div style={{ flex: 'none', width: 72, aspectRatio: '3/4', border: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>
                3 : 4
              </div>
            )}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, lineHeight: 1.4, color: 'var(--color-ink)' }}>
                {listing.title.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
                {listing.brand.toUpperCase()} · {listing.size.toUpperCase()}
              </span>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)' }}>
              <span>PRICE</span>
              <span>{formatCents(amounts.item_cents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
              <span>BUYER FEE 2%</span>
              <span>{formatCents(amounts.buyer_fee_cents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
              <span>SHIPPING</span>
              <span>{formatCents(amounts.shipping_cents)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--color-line)', marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--color-ink)' }}>
              <span>TOTAL</span>
              <span>{formatCents(amounts.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Right: Payment form (client component, mounts Stripe Elements) */}
        <CheckoutClient
          listingId={listingId}
          totalCents={amounts.total_cents}
          savedAddress={profile?.shipping_address as Record<string, string> | null}
        />
      </div>
    </div>
  )
}
