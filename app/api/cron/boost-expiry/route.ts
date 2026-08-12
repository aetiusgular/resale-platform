/**
 * GET /api/cron/boost-expiry — Fee Model v3 boost hygiene.
 *
 * Marks active boosts whose window has ended as 'expired' and clears the
 * denormalized listings.boosted_until so nothing stale keeps floating in browse.
 * Scheduling: this runs automatically in-DB via pg_cron (migration 0035) — no
 * external scheduler needed. This endpoint is an OPTIONAL on-demand trigger that
 * invokes the same expire_boosts() function. Protected by CRON_SECRET (Bearer).
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

  // The actual sweep is the SECURITY DEFINER SQL function expire_boosts(), which
  // pg_cron also runs hourly (migration 0035). This route is an on-demand trigger
  // over the SAME function, so there is exactly one implementation.
  const service = createServiceClientRaw()
  const { error } = await service.rpc('expire_boosts')
  if (error) {
    console.error('[boost-expiry] expire_boosts rpc error:', error)
    return NextResponse.json({ error: 'boost sweep failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
