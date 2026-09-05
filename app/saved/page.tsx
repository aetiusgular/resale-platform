import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FOLLOWS_ENABLED, SAVED_SEARCH_ALERTS_ENABLED } from '@/lib/flags'
import { loadSavedHub } from '@/lib/loaders/saved'
import AppShell from '@/app/components/app-shell'
import SavedClient from './saved-client'

export const metadata: Metadata = {
  title: 'Saved',
  description: 'Your saved items, searches and sellers.',
}

export type { SavedListing, SavedSearchRow, FollowedSeller } from '@/lib/loaders/saved'

export default async function SavedPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/saved (native clients).
  const d = await loadSavedHub({ supabase, user })
  const username = d.viewer.username
  const displayName: string | undefined = d.viewer.display_name ?? undefined
  const savedListings = d.listings
  const searches = d.searches
  const sellers = d.sellers
  const dropsSince = d.since_visit.drops
  const soldSince = d.since_visit.sold
  const lastVisit = d.since_visit.had_visit

  return (
    <AppShell username={username} displayName={displayName}>
      <Suspense>
        <SavedClient
          listings={savedListings}
          searches={searches}
          sellers={sellers}
          sinceVisit={{ drops: dropsSince, sold: soldSince, hadVisit: lastVisit }}
          followsEnabled={FOLLOWS_ENABLED}
          alertsEnabled={SAVED_SEARCH_ALERTS_ENABLED}
        />
      </Suspense>
    </AppShell>
  )
}
