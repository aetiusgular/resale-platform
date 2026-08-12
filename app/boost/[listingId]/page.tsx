import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BOOSTED_POSTS_ENABLED } from '@/lib/flags'
import { BOOST_PACKAGES } from '@/lib/boosts'
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
    .select('id, title, brand, seller_id, status, boosted_until')
    .eq('id', listingId)
    .single()
  const l = listing as
    | { id: string; title: string; brand: string; seller_id: string; status: string; boosted_until: string | null }
    | null
  if (!l || l.seller_id !== user.id) notFound()

  return (
    <BoostClient
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
