/**
 * POST /api/recs/seed { aesthetics: string[] } — cold-start taste seed.
 *
 * Derives the user_key SERVER-SIDE from the authenticated session (never trusts a
 * client-supplied key) and forwards the picks to the engine's seed endpoint via
 * lib/recs/client (feed token stays server-side). FAIL-SOFT: always 200 so the
 * onboarding flow can never be blocked by recs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { seedUser, userKeyFor } from '@/lib/recs/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 200 })

  let body: { aesthetics?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  const raw = Array.isArray(body.aesthetics) ? body.aesthetics : []
  const aesthetics = raw.filter((k): k is string => typeof k === 'string' && k.length > 0).slice(0, 32)
  if (aesthetics.length === 0) return NextResponse.json({ ok: false }, { status: 200 })

  const ok = await seedUser(userKeyFor(user.id, ''), aesthetics)
  return NextResponse.json({ ok }, { status: 200 })
}
