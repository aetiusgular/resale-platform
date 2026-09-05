/**
 * GET /api/mobile/config — public boot config for native clients: force-upgrade floor per
 * platform, the public flag subset, and the web paths the app links to. No secrets; keys the app
 * needs (Supabase URL/anon, Stripe publishable) ship in its xcconfig.
 */
import { NextRequest, NextResponse } from 'next/server'
import { publicFlags } from '@/lib/loaders/viewer'
import { MIN_BUILD, nativeClient } from '@/lib/api/native'

export async function GET(request: NextRequest) {
  const client = nativeClient(request)
  const minBuild = client ? MIN_BUILD[client.platform] : null
  return NextResponse.json({
    min_build: MIN_BUILD,
    /** True when the calling build is below the floor and must update before continuing. */
    upgrade_required: !!client && minBuild !== null && client.build < minBuild,
    flags: publicFlags(),
    links: { terms: '/terms', privacy: '/privacy', fees: '/fees', help: '/help', trust: '/trust', about: '/about' },
    scheme: 'archive',
  })
}
