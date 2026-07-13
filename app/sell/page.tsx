import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SellForm from './sell-form'

export const metadata = { title: 'List an item' }

export default async function SellPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/enter')

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ height: '64px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px' }}>
        <Link href="/" style={{ font: '600 16px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)', textDecoration: 'none' }}>———</Link>
        <span style={{ font: '600 14px var(--font-ui)', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>List an item</span>
        <Link href="/" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>Cancel</Link>
      </header>

      {/* Step indicator (sticky visual guide) */}
      <div style={{ borderBottom: '1px solid var(--color-line)', background: 'var(--color-bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px', height: '56px', padding: '0 24px' }}>
          {[
            { n: '01', label: 'Photos' },
            { n: '02', label: 'Details' },
            { n: '03', label: 'Condition' },
            { n: '04', label: 'Price' },
          ].map((step, i) => (
            <>
              <span key={step.n} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>{step.n}</span>
                <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>{step.label}</span>
              </span>
              {i < 3 && <span style={{ color: 'var(--color-ink-soft)', fontSize: '12px' }}>→</span>}
            </>
          ))}
        </div>
      </div>

      <SellForm userId={user.id} />
    </div>
  )
}
