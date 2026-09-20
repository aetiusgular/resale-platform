/**
 * "more lots" — the rail that closes the listing page. An async server component
 * behind its own <Suspense> in page.tsx: it streams in after the placard, so two
 * extra read queries never sit on the listing's first paint.
 *
 * Data: lib/loaders/more-lots (other active listings, this category first).
 * Fail-soft — no lots, no rail.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import LotsCarousel from '@/app/components/lots-carousel'
import { loadMoreLots } from '@/lib/loaders/more-lots'

export default async function MoreLots({ supabase, user, listing, showAuthBadge }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
  user: User | null
  listing: { id: string; category: string; department: string }
  showAuthBadge: boolean
}) {
  const { lots, savedIds } = await loadMoreLots({ supabase, user, listing })
  if (lots.length < 2) return null
  return (
    <LotsCarousel
      // Remount on sign-in / sign-out: the saved set below is the carousel's initial state.
      key={user?.id ?? 'guest'}
      listings={lots}
      label="more lots"
      isGuest={!user}
      initialSavedIds={savedIds}
      showAuthBadge={showAuthBadge}
    />
  )
}
