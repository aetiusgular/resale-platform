/**
 * GET /api/cron/boost-expiry — Fee Model v3 boost hygiene.
 *
 * Marks active boosts whose window has ended as 'expired' and clears the
 * denormalized listings.boosted_until so nothing stale keeps floating in browse.
 * Protected by CRON_SECRET (Bearer). Idempotent; safe to run frequently (e.g.
 * hourly). No NOTIFICATIONS gate — pure data hygiene. The browse ranking already
 * self-heals (applyBoostOrder only floats listings whose boosted_until > now), so
 * this sweep is about keeping the boosts table and flag accurate for reporting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[boost-expiry] CRON_SECRET is not set — refusing to run')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClientRaw()
  const nowIso = new Date().toISOString()

  // 1) Retire boosts whose window has passed.
  const { data: expired, error: bErr } = await service
    .from('boosts')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('ends_at', nowIso)
    .select('id')
  if (bErr) {
    console.error('[boost-expiry] boost update error:', bErr)
    return NextResponse.json({ error: 'boost sweep failed' }, { status: 500 })
  }

  // 2) Clear the denormalized listing flag for any listing past its boost window.
  const { error: lErr } = await service
    .from('listings')
    .update({ boosted_until: null })
    .lt('boosted_until', nowIso)
  if (lErr) {
    console.error('[boost-expiry] listing cleanup error:', lErr)
    return NextResponse.json({ error: 'listing cleanup failed' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = Array.isArray(expired) ? (expired as any[]).length : 0
  return NextResponse.json({ ok: true, expired: count })
}
