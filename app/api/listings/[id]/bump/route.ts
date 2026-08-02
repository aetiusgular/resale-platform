/**
 * POST /api/listings/[id]/bump — a seller refreshes their own active listing.
 *
 * Behind BUMP_ENABLED (404 when off). Eligibility is the pure rule in
 * lib/bump/eligibility.ts: a free bump every 7 days, or an early bump on a >=10%
 * markdown below the last-bump price. Rate-limited as an abuse backstop on top of the
 * rule. The write uses the SERVICE client because the seller RLS WITH CHECK forbids
 * updates that keep status='active' — ownership + active are re-checked here first.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { BUMP_ENABLED } from '@/lib/flags'
import { bumpEligibility } from '@/lib/bump/eligibility'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!BUMP_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  const { id } = await params

  const rl = checkRateLimit(`bump:${user.id}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const service = await createServiceClient()
  const { data: listing } = await service
    .from('listings')
    .select('seller_id, status, price_cents, bumped_at, bumped_price_cents')
    .eq('id', id)
    .single()

  // Own-listing check doubles as existence check — don't leak others' listings.
  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  if (listing.status !== 'active') {
    return NextResponse.json({ error: 'Only active listings can be bumped' }, { status: 409 })
  }

  const eligibility = bumpEligibility({
    nowMs: Date.now(),
    bumpedAtMs: listing.bumped_at ? Date.parse(listing.bumped_at) : null,
    currentPriceCents: listing.price_cents,
    priceAtLastBumpCents: listing.bumped_price_cents ?? null,
  })
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        error: 'Not eligible to bump yet',
        reason: eligibility.reason,
        nextEligibleAtMs: eligibility.nextEligibleAtMs,
        qualifyingPriceDropPct: eligibility.qualifyingPriceDropPct,
      },
      { status: 409 },
    )
  }

  const nowIso = new Date().toISOString()
  const { error } = await service
    .from('listings')
    .update({ bumped_at: nowIso, bumped_price_cents: listing.price_cents })
    .eq('id', id)
    .eq('status', 'active')

  if (error) {
    console.error('[bump] update error:', error)
    return NextResponse.json({ error: 'Failed to bump' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, reason: eligibility.reason, bumped_at: nowIso })
}
