/**
 * /settings/payouts
 * Stripe Connect Express onboarding for sellers.
 * Shows current payout status and a CTA to complete onboarding.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ onboarding?: string }>
}

export default async function PayoutsSettingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('payouts_enabled, stripe_connect_account_id')
    .eq('id', user.id)
    .single()

  const { onboarding } = await searchParams
  const justCompleted = onboarding === 'complete'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/settings" style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>
          ← Settings
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)', marginTop: 32, marginBottom: 32 }}>
          Payouts
        </h1>

        {/* Status banner */}
        {justCompleted && !profile?.payouts_enabled && (
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2, padding: '14px 16px', marginBottom: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>
            ONBOARDING SUBMITTED — STRIPE IS REVIEWING YOUR ACCOUNT.
            THIS PAGE WILL UPDATE ONCE PAYOUTS ARE ENABLED (usually within minutes).
          </div>
        )}

        {profile?.payouts_enabled ? (
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
              Stripe Connect
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--color-accent)', fontSize: 14, flex: 'none' }}>✓</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)' }}>PAYOUTS ENABLED</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: 0 }}>
                Your Stripe account is connected. Funds are transferred automatically after buyers confirm delivery (or after 3 days).
              </p>
              <a href="/api/stripe/connect" style={{ alignSelf: 'flex-start', font: '500 13px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Manage Stripe account →
              </a>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--color-line)', borderRadius: 2 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
              Stripe Connect
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-ink)', margin: 0 }}>
                Connect your bank account to receive payouts. Required before your listings can be approved and go active.
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  '2% seller fee deducted from each sale',
                  'Funds held in escrow until delivery confirmation',
                  'Auto-released after 3 days',
                  'Disputes resolved within 72h window',
                ].map((text, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>{text}</li>
                ))}
              </ul>
              <a
                href="/api/stripe/connect"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 44,
                  background: 'var(--color-ink)',
                  color: 'var(--color-bg)',
                  borderRadius: 2,
                  font: '500 14px var(--font-ui)',
                  letterSpacing: '-0.01em',
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                Connect Stripe account
              </a>

              {/* PayPal: disabled stub */}
              <div style={{ marginTop: 8, border: '1px solid var(--color-line)', borderRadius: 2, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '500 13px var(--font-ui)', color: 'var(--color-ink-soft)' }}>PayPal</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-soft)', background: 'rgba(0,0,0,.06)', padding: '2px 6px', borderRadius: 2 }}>BETA</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
