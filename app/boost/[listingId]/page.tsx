import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED } from '@/lib/flags'
import { BOOST_PACKAGES } from '@/lib/boosts'
import { BUMP_COOLDOWN_MS } from '@/lib/bump/eligibility'
import BoostClient from './boost-client'

export const metadata = { title: 'Boost listing — Resale Platform' }

export default async function BoostPage({ params }: { params: Promise<{ listingId: string }> }) {
  if (!BOOSTED_POSTS_ENABLED) notFound()
  const { listingId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, brand, seller_id, status, boosted_until, bumped_at')
    .eq('id', listingId)
    .single()
  const l = listing as
    | { id: string; title: string; brand: string; seller_id: string; status: string; boosted_until: string | null; bumped_at: string | null }
    | null
  if (!l || l.seller_id !== user.id) notFound()

  // Free-bump cross-link (BUMP_ENABLED): surface the no-cost weekly refresh beside the
  // paid packages so sellers see both halves of the visibility economy in one place.
  // eslint-disable-next-line react-hooks/purity -- server component render; bump freshness at request time
  const nowMs = Date.now()
  const bumpedAtMs = l.bumped_at ? Date.parse(l.bumped_at) : null
  const freeBump =
    BUMP_ENABLED && l.status === 'active'
      ? bumpedAtMs === null || nowMs - bumpedAtMs >= BUMP_COOLDOWN_MS
        ? { availableNow: true, nextAtIso: null }
        : { availableNow: false, nextAtIso: new Date(bumpedAtMs + BUMP_COOLDOWN_MS).toISOString() }
      : null

  return (
    <BoostClient
      freeBump={freeBump}
      listingId={l.id}
      title={l.title}
      brand={l.brand}
      active={l.status === 'active'}
      boostedUntil={l.boosted_until}
      packages={BOOST_PACKAGES.map((p) => ({
        key: p.key, label: p.label, amountCents: p.amountCents, durationDays: p.durationDays,
      }))}
    />
  )
}
