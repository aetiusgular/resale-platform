/**
 * GET /api/cron/tier-expiry  (business-model-v2 §1f — expiring-volume push)
 *
 * Warns users whose trailing-365-day activity is about to roll out of the window
 * in the next EXPIRY_WARNING_DAYS and would drop their fee tier, so they can act
 * before their rate rises. Candidate users are those with COUNTED orders created
 * between 365 and 351 days ago; each is re-evaluated authoritatively via
 * getTierDashboard, and only a genuine projected drop is notified.
 *
 * Protected by CRON_SECRET (Bearer). Behind NOTIFICATIONS_ENABLED — no-ops when
 * notifications aren't live. Deduped to at most one warning per user per 14 days
 * using the notifications table (the in-app row notify() always writes), so no
 * extra state/migration is needed. Fail-soft per user: one failure never aborts
 * the sweep. Intended for a daily scheduler.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { TRAILING_DAYS, COUNTED_STATES } from '@/lib/fee-tier'
import { getTierDashboard, pickWorseningSide, EXPIRY_WARNING_DAYS } from '@/lib/tier-dashboard'
import { notify } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[tier-expiry] CRON_SECRET is not set — refusing to run')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ skipped: 'notifications_disabled' })
  }

  const service = createServiceClientRaw()
  const now = Date.now()

  // Orders that are still in-window now but exit within the warning horizon:
  // created between 365d ago (exclusive) and 351d ago (inclusive).
  const windowStartIso = new Date(now - TRAILING_DAYS * DAY_MS).toISOString()
  const warnEdgeIso = new Date(now - (TRAILING_DAYS - EXPIRY_WARNING_DAYS) * DAY_MS).toISOString()

  const { data: expiring } = await service
    .from('orders')
    .select('buyer_id, seller_id')
    .gt('created_at', windowStartIso)
    .lte('created_at', warnEdgeIso)
    .in('state', COUNTED_STATES as unknown as string[])
    .limit(2000)

  const userIds = [
    ...new Set(
      (expiring ?? [])
        .flatMap((o) => [o.buyer_id as string | null, o.seller_id as string | null])
        .filter((v): v is string => Boolean(v)),
    ),
  ]
  if (userIds.length === 0) {
    return NextResponse.json({ candidates: 0, notified: 0 })
  }

  // Dedup: users already warned within the last 14 days (in-app row always exists).
  const sinceIso = new Date(now - EXPIRY_WARNING_DAYS * DAY_MS).toISOString()
  const { data: recent } = await service
    .from('notifications')
    .select('user_id')
    .eq('type', 'tier_expiry')
    .gte('created_at', sinceIso)
    .in('user_id', userIds)
  const warned = new Set((recent ?? []).map((r) => r.user_id as string))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? undefined
  let notified = 0
  let skipped = 0

  for (const uid of userIds) {
    if (warned.has(uid)) { skipped++; continue }
    try {
      const [seller, buyer] = await Promise.all([
        getTierDashboard(service, uid, 'seller'),
        getTierDashboard(service, uid, 'buyer'),
      ])
      const worse = pickWorseningSide(seller, buyer)
      if (!worse) continue
      await notify(service, uid, 'tier_expiry', {
        tierSide: worse.side,
        fromBps: worse.activityBps,
        toBps: worse.projectedBps,
        appUrl,
      })
      notified++
    } catch (err) {
      console.error(`[tier-expiry] failed for user ${uid}:`, err)
    }
  }

  return NextResponse.json({ candidates: userIds.length, notified, alreadyWarned: skipped })
}
