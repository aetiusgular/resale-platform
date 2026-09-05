import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import BrowseClient from './browse-client'
import JsonLd from '@/app/components/json-ld'
import AppShell from '@/app/components/app-shell'
import { organizationJsonLd, webSiteJsonLd } from '@/lib/seo-listing'
import { AUTH_BADGE_ENABLED, RECS_TELEMETRY_ENABLED } from '@/lib/flags'
import { loadBrowse } from '@/lib/loaders/browse'

export const metadata: Metadata = {
  title: 'Browse',
  description: 'Browse curated secondhand fashion listings.',
  // Every filter/sort/offset/q permutation canonicalizes to clean /browse —
  // facet URLs are never the ranking surface (brand/category landing pages
  // will be, once the wiki exists).
  alternates: { canonical: '/browse' },
}

export type { BrowseListing, FilterCounts } from '@/lib/loaders/browse'

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Guests browse freely (user === null). Everything user-scoped — the
  // personalized feed, the saved-set, the profile size prefs — is guarded on
  // `user` inside the loader and simply skipped for a signed-out visitor. Write
  // actions are gated client-side (auth popup) and server-side (401 + RLS).
  const { data: { user } } = await supabase.auth.getUser()

  // ONE data assembly shared with GET /api/browse (native clients + load-more).
  const b = await loadBrowse({ supabase, user, params, includeFacets: true })
  const q = b.filters.q
  const username = b.username

  return (
    <>
      {/* Effective homepage (/ redirects here): site-level structured data. */}
      <JsonLd data={webSiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <AppShell username={username} searchValue={q}>
        <Suspense>
          <BrowseClient
            initialListings={b.listings}
            totalCount={b.totalCount ?? 0}
            filterCounts={b.filterCounts!}
            initialSavedIds={b.savedIds}
            userSizes={b.userSizes}
            mySizesOn={b.mySizesOn}
            hasMore={b.hasMore}
            currentOffset={b.offset}
            username={username}
            authBadgeEnabled={AUTH_BADGE_ENABLED}
            userId={user?.id ?? ''}
            recsTelemetryEnabled={RECS_TELEMETRY_ENABLED}
          />
        </Suspense>
      </AppShell>
    </>
  )
}
