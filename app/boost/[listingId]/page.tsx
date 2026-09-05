import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { loadBoostState } from '@/lib/loaders/boost'
import AppShell from '@/app/components/app-shell'
import BoostClient from './boost-client'

export const metadata = { title: 'Boost listing' }

export default async function BoostPage({ params }: { params: Promise<{ listingId: string }> }) {
  if (!BOOSTED_POSTS_ENABLED) notFound()
  const { listingId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/boosts?listingId= (native clients).
  const b = await loadBoostState({ supabase, user, listingId })
  if (!b) notFound()

  return (
    <AppShell username={b.viewer.username}>
      <BoostClient
        freeBump={b.free_bump}
        listingId={b.listing.id}
        title={b.listing.title}
        brand={b.listing.brand}
        active={b.listing.active}
        boostedUntil={b.listing.boosted_until}
        packages={b.packages}
      />
    </AppShell>
  )
}
