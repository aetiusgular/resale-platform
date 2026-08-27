/**
 * /banned — shown to a user whose account has been suspended (G6 ban).
 * Reached via the middleware redirect; intentionally minimal and reachable with a session.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

export const metadata = { title: 'Account suspended', robots: { index: false, follow: false } }

export default async function BannedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let reason: string | null = null
  if (user) {
    const { data } = await createServiceClientRaw()
      .from('profiles')
      .select('banned_reason')
      .eq('id', user.id)
      .single()
    reason = (data as { banned_reason?: string | null } | null)?.banned_reason ?? null
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ font: '400 28px var(--font-serif)', color: 'var(--color-ink)', margin: 0 }}>Account suspended</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.6, color: 'var(--color-ink-soft)', margin: 0 }}>
          Your account has been suspended for violating our terms. You can’t browse, buy, or sell while suspended.
        </p>
        {reason && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', margin: 0 }}>
            Reason: {reason}
          </p>
        )}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)', margin: 0 }}>
          If you believe this is a mistake, contact support to appeal.
        </p>
      </div>
    </div>
  )
}
