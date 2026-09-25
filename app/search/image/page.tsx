import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/app/components/app-shell'
import { createClient } from '@/lib/supabase/server'
import { AUTH_BADGE_ENABLED, RECS_TELEMETRY_ENABLED, VISUAL_SEARCH_PUBLIC_ENABLED } from '@/lib/flags'
import VisualResults from './visual-results'

/**
 * /search/image — search-by-image results (design page 21, R1 / R2 desktop, M2 mobile).
 * The query image and the response live in client memory (lib/visual-search/store.ts):
 * nothing is in the URL, nothing is fetched here. A reload lands on the empty state, which
 * asks for a paste. 404 while the public flag is off, like the control it belongs to.
 */
export const metadata: Metadata = {
  title: 'Search by image',
  description: 'Find a listing from a photo, or the closest pieces when it is not listed.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function VisualSearchPage() {
  if (!VISUAL_SEARCH_PUBLIC_ENABLED) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let username = ''
  if (user) {
    const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    username = (data as { username?: string } | null)?.username ?? ''
  }
  return (
    <AppShell username={username}>
      <VisualResults
        username={username}
        userId={user?.id ?? ''}
        authBadgeEnabled={AUTH_BADGE_ENABLED}
        recsTelemetryEnabled={RECS_TELEMETRY_ENABLED}
      />
    </AppShell>
  )
}
