/**
 * /sell/new — create-listing wizard (reference WizardView). `?draft=<id>`
 * continues a draft (CONTINUE → / RELIST), `?edit=<id>` edits a live listing.
 * Same gates as before: session, and the seller ID-verification gate behind
 * VERIFICATION_ENABLED.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/components/app-shell'
import SellForm from '../sell-form'
import { loadSellNew } from '@/lib/loaders/sell'

export const metadata: Metadata = { title: 'New listing' }

interface PageProps {
  searchParams: Promise<{ draft?: string; edit?: string }>
}

export default async function NewListingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { draft, edit } = await searchParams

  // ONE data assembly shared with GET /api/sell/new (native clients): the seller
  // ID-verification gate, fee inputs and the ?edit= / ?draft= prefill.
  const g = await loadSellNew({ supabase, user, draft, edit })
  // Seller ID-verification gate (behind VERIFICATION_ENABLED): send a risk-flagged
  // or high-volume unverified seller to verification instead of the listing form.
  if (g.must_verify) redirect('/onboarding/verify?required=sell')
  if (g.row_missing) redirect('/sell')

  return (
    <AppShell username={g.viewer.username} displayName={g.viewer.display_name ?? undefined}>
      <SellForm userId={user.id} sellerBps={g.seller_bps} welcomeSalesRemaining={g.welcome_sales_remaining} initial={g.initial} mode={g.mode} />
    </AppShell>
  )
}
