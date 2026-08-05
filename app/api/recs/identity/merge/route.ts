/**
 * POST /api/recs/identity/merge { deviceId } — fold an anonymous device profile
 * into the now-authenticated account.
 *
 * The device_id lives only in the browser (localStorage), so the client sends it
 * here; the account_key is derived SERVER-SIDE from the session. Forwards to the
 * engine's identity-merge endpoint via lib/recs/client. FAIL-SOFT: always 200.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mergeIdentity, userKeyFor } from '@/lib/recs/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 200 })

  let body: { deviceId?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  if (deviceId.length < 8) return NextResponse.json({ ok: false }, { status: 200 })

  const ok = await mergeIdentity(`d:${deviceId}`, userKeyFor(user.id, ''))
  return NextResponse.json({ ok }, { status: 200 })
}
