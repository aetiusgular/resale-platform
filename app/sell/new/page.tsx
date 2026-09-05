/**
 * /sell/new — create-listing wizard (reference WizardView). `?draft=<id>`
 * continues a draft (CONTINUE → / RELIST), `?edit=<id>` edits a live listing.
 * Same gates as before: session, and the seller ID-verification gate behind
 * VERIFICATION_ENABLED.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { WELCOME_SALES } from '@/lib/fees'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'
import { normalizeMeasurements } from '@/lib/taxonomy'
import AppShell from '@/app/components/app-shell'
import SellForm, { type ListingInitial } from '../sell-form'

export const metadata: Metadata = { title: 'New listing' }

interface PageProps {
  searchParams: Promise<{ draft?: string; edit?: string }>
}

const UUID_RE = /^[0-9a-f-]{36}$/i

export default async function NewListingPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Seller ID-verification gate (behind VERIFICATION_ENABLED): send a risk-flagged
  // or high-volume unverified seller to verification instead of the listing form.
  if (VERIFICATION_ENABLED) {
    const svc = createServiceClientRaw()
    const { data: vp } = await svc
      .from('profiles')
      .select('id_verification_status')
      .eq('id', user.id)
      .single()
    const verified =
      (vp as { id_verification_status?: string } | null)?.id_verification_status === 'verified'
    if (!verified && (await sellerMustVerify(svc, user.id))) redirect('/onboarding/verify?required=sell')
  }

  const { draft, edit } = await searchParams
  const rowId = edit && UUID_RE.test(edit) ? edit : draft && UUID_RE.test(draft) ? draft : null
  const mode: 'new' | 'edit' = edit && UUID_RE.test(edit) ? 'edit' : 'new'

  const [{ data: profile }, sellerBps, { data: row }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, lifetime_sales_count').eq('id', user.id).single(),
    resolveEffectiveBps(createServiceClientRaw(), user.id, 'seller'),
    rowId
      ? supabase
          .from('listings')
          .select('id, seller_id, status, title, brand, category, department, subcategory, size, color, description, condition_score, price_cents, images, possession_photo_url, measurements')
          .eq('id', rowId)
          .eq('seller_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const username: string = (profile?.username as string) ?? ''
  const salesCount: number = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeSalesRemaining = Math.max(0, WELCOME_SALES - salesCount)

  let initial: ListingInitial | null = null
  if (row) {
    const okForMode = mode === 'edit' ? ['active', 'pending_review'].includes(row.status) : row.status === 'draft'
    if (!okForMode) redirect('/sell')
    initial = {
      id: row.id,
      status: row.status,
      title: row.title ?? null,
      brand: row.brand ?? null,
      category: row.category ?? null,
      department: row.department ?? 'menswear',
      subcategory: row.subcategory ?? null,
      size: row.size ?? null,
      color: row.color ?? null,
      description: row.description ?? null,
      condition_score: row.condition_score ?? null,
      price_cents: row.price_cents ?? null,
      images: Array.isArray(row.images) ? row.images : [],
      possession_photo_url: row.possession_photo_url ?? null,
      measurements: normalizeMeasurements(row.measurements, row.category),
    }
  } else if (rowId) {
    redirect('/sell')
  }

  return (
    <AppShell username={username} displayName={(profile?.display_name as string | null) ?? undefined}>
      <SellForm userId={user.id} sellerBps={sellerBps} welcomeSalesRemaining={welcomeSalesRemaining} initial={initial} mode={mode} />
    </AppShell>
  )
}
