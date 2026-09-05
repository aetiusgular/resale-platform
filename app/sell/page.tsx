/**
 * /sell — the seller's catalog (reference CatalogView): stats line "n ACTIVE ·
 * n DRAFTS · n SOLD · TIER 2 — 9.0% FEE", ACTIVE / DRAFTS / SOLD tabs, cards
 * with "214 VIEWS · 18 SAVES · 1 OFFER · LISTED 4D", EDIT · BUMP ↑ · OFFER $x,
 * drafts "3 OF 6 PHOTOS · NO PRICE SET" + CONTINUE →, sold "SOLD AUG 12 · PAID
 * OUT $373" + RELIST / VIEW ORDER. NEW LISTING + → /sell/new.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { BOOSTED_POSTS_ENABLED, BUMP_ENABLED } from '@/lib/flags'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import SellCatalog from './sell-catalog'
import { loadSellCatalog } from '@/lib/loaders/sell'

export const metadata: Metadata = { title: 'Sell' }

export default async function SellPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/sell/catalog (native clients).
  const c = await loadSellCatalog({ supabase, user })

  return (
    <AppShell username={c.viewer.username} displayName={c.viewer.display_name ?? undefined}>
      <SellCatalog
        listings={c.listings}
        feeLine={c.fee_line}
        bumpEnabled={BUMP_ENABLED}
        boostEnabled={BOOSTED_POSTS_ENABLED}
        newListing={<PrefetchLink href="/sell/new" className="btn-primary btn-primary--inline" data-testid="new-listing">NEW LISTING +</PrefetchLink>}
      />
    </AppShell>
  )
}
