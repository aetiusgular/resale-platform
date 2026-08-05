/**
 * GET /api/recs/aesthetics — thin server proxy for the cold-start picker.
 *
 * Returns the engine's 16 aesthetic options ({ key, display_name }) so the
 * onboarding client can render a picker WITHOUT ever holding the feed token
 * (which stays server-side in lib/recs/client). FAIL-SOFT: on disabled /
 * unreachable / error, returns { aesthetics: [] } and the client hides the card.
 */
import { NextResponse } from 'next/server'
import { getAesthetics } from '@/lib/recs/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const res = await getAesthetics()
  return NextResponse.json(res ?? { aesthetics: [] }, { status: 200 })
}
