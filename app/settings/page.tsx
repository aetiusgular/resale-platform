import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/app/components/site-header'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single()
  const username: string = (profile?.username as string) ?? ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <SiteHeader username={username} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', marginBottom: 32 }}>
          Settings
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/settings/payouts" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--color-line)', textDecoration: 'none', color: 'var(--color-ink)', font: '500 14px var(--font-ui)' }}>
            <span>Payouts</span>
            <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Stripe Connect →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
