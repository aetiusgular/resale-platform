import { Fragment } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MobileTabBar from '@/app/components/mobile-tabbar'
import SellForm from './sell-form'
import { resolveEffectiveBps } from '@/lib/tier-progress'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { WELCOME_SALES } from '@/lib/fees'
import { sellerMustVerify } from '@/lib/idv/risk-resolver'

export const metadata = { title: 'List an item' }

export default async function SellPage() {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, lifetime_sales_count')
    .eq('id', user.id)
    .single()
  const username: string = (profile?.username as string) ?? ''
  const salesCount: number = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeSalesRemaining = Math.max(0, WELCOME_SALES - salesCount)

  // Seller's fee rate — set by their trailing-365d sales volume (see lib/fee-tier).
  const sellerBps = await resolveEffectiveBps(createServiceClientRaw(), user.id, 'seller')

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }} className="mobile-bottom-pad">
      {/* Header */}
      <header style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <Link href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>———</Link>
        <span style={{ font: '600 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>List an item</span>
        <Link href="/" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
      </header>

      {/* Step indicator (sticky visual guide) — wraps on narrow screens */}
      <div style={{ borderBottom: '1px solid var(--color-line)', background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '48px', padding: '8px 16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { n: '01', label: 'Photos' },
            { n: '02', label: 'Details' },
            { n: '03', label: 'Condition' },
            { n: '04', label: 'Price' },
          ].map((step, i) => (
            <Fragment key={step.n}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>{step.n}</span>
                <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>{step.label}</span>
              </span>
              {i < 3 && <span style={{ color: 'var(--color-ink-soft)', fontSize: '10px' }}>→</span>}
            </Fragment>
          ))}
        </div>
      </div>

      <SellForm userId={user.id} sellerBps={sellerBps} welcomeSalesRemaining={welcomeSalesRemaining} />
      <MobileTabBar username={username} />
    </div>
  )
}
