/**
 * Boost page loader — /boost/[listingId] and GET /api/boosts?listingId=.
 * Own active listings only. Surfaces the paid packages beside the free weekly bump
 * (BUMP_ENABLED) so sellers see both halves of the visibility economy in one place.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED } from '@/lib/flags'
import { BOOST_PACKAGES } from '@/lib/boosts'
import { BUMP_COOLDOWN_MS } from '@/lib/bump/eligibility'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type BoostState = {
  viewer: { username: string }
  listing: { id: string; title: string; brand: string; active: boolean; boosted_until: string | null; bumped_at: string | null }
  free_bump: { availableNow: boolean; nextAtIso: string | null } | null
  packages: Array<{ key: string; label: string; amountCents: number; durationDays: number }>
  flags: { boost: boolean; bump: boolean }
}

/** null = feature off, listing missing, or not the viewer's listing → 404. */
export async function loadBoostState(opts: { supabase: Client; user: User; listingId: string }): Promise<BoostState | null> {
  if (!BOOSTED_POSTS_ENABLED) return null
  const { supabase, user, listingId } = opts
  const [{ data: listing }, { data: profile }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, brand, seller_id, status, boosted_until, bumped_at')
      .eq('id', listingId)
      .single(),
    supabase.from('profiles').select('username').eq('id', user.id).single(),
  ])
  const l = listing as
    | { id: string; title: string; brand: string; seller_id: string; status: string; boosted_until: string | null; bumped_at: string | null }
    | null
  if (!l || l.seller_id !== user.id) return null

  const nowMs = Date.now()
  const bumpedAtMs = l.bumped_at ? Date.parse(l.bumped_at) : null
  const freeBump =
    BUMP_ENABLED && l.status === 'active'
      ? bumpedAtMs === null || nowMs - bumpedAtMs >= BUMP_COOLDOWN_MS
        ? { availableNow: true, nextAtIso: null }
        : { availableNow: false, nextAtIso: new Date(bumpedAtMs + BUMP_COOLDOWN_MS).toISOString() }
      : null

  return {
    viewer: { username: (profile?.username as string) ?? '' },
    listing: { id: l.id, title: l.title, brand: l.brand, active: l.status === 'active', boosted_until: l.boosted_until, bumped_at: l.bumped_at },
    free_bump: freeBump,
    packages: BOOST_PACKAGES.map((p) => ({ key: p.key, label: p.label, amountCents: p.amountCents, durationDays: p.durationDays })),
    flags: { boost: BOOSTED_POSTS_ENABLED, bump: BUMP_ENABLED },
  }
}
