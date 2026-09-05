/**
 * POST /api/boosts — purchase a paid listing boost (Fee Model v3).
 * A boost is 100% platform revenue: a standalone Stripe charge with NO Connect
 * transfer. Creates a pending boost + PaymentIntent; the webhook activates it on
 * payment success (metadata.kind === 'boost'). Flag-gated by BOOSTED_POSTS_ENABLED.
 *
 * GET /api/boosts?listingId=<uuid> — the boost page state (packages, current boost, free bump)
 * for the viewer's own listing (lib/loaders/boost).
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { boostPackage } from '@/lib/boosts'
import { requireUser } from '@/lib/supabase/server'
import { loadBoostState } from '@/lib/loaders/boost'
import { ApiError, respond } from '@/lib/api/respond'

const UUID_RE_GET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  return respond(async () => {
    if (!BOOSTED_POSTS_ENABLED) throw new ApiError(404, 'Not available')
    const listingId = request.nextUrl.searchParams.get('listingId') ?? ''
    if (!UUID_RE_GET.test(listingId)) throw new ApiError(400, 'listingId (uuid) required')
    const { supabase, user } = await requireUser()
    const state = await loadBoostState({ supabase, user, listingId })
    if (!state) throw new ApiError(404, 'Listing not found')
    return state
  })
}

export async function POST(request: NextRequest) {
  if (!BOOSTED_POSTS_ENABLED) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { listingId?: unknown; package?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const listingId = typeof body.listingId === 'string' ? body.listingId : ''
  const pkg = boostPackage(typeof body.package === 'string' ? body.package : '')
  if (!listingId || !pkg) return NextResponse.json({ error: 'Invalid boost request' }, { status: 400 })

  const service = createServiceClientRaw()
  const { data: listing } = await service
    .from('listings').select('id, seller_id, status, title').eq('id', listingId).single()
  const l = listing as { id: string; seller_id: string; status: string; title: string } | null
  if (!l || l.seller_id !== user.id) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (l.status !== 'active') return NextResponse.json({ error: 'Only active listings can be boosted' }, { status: 422 })

  const boostId = randomUUID()
  let pi
  try {
    pi = await stripe.paymentIntents.create({
      amount: pkg.amountCents,
      currency: 'usd',
      metadata: { kind: 'boost', boost_id: boostId, listing_id: listingId, seller_id: user.id, package: pkg.key },
      description: `Boost: ${l.title} — ${pkg.label}`,
    })
  } catch (e) {
    console.error('[boosts] stripe error:', e)
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  const { error: insErr } = await service.from('boosts').insert({
    id: boostId, listing_id: listingId, seller_id: user.id,
    package: pkg.key, duration_days: pkg.durationDays, amount_cents: pkg.amountCents,
    status: 'pending', stripe_payment_intent_id: pi.id,
  })
  if (insErr) {
    await stripe.paymentIntents.cancel(pi.id).catch(() => {})
    console.error('[boosts] insert error:', insErr)
    return NextResponse.json({ error: 'Could not create boost' }, { status: 500 })
  }

  return NextResponse.json({ clientSecret: pi.client_secret, amountCents: pkg.amountCents })
}
