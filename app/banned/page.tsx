/**
 * /banned — shown to a user whose account has been suspended (G6 ban).
 * Reached via the middleware redirect; intentionally minimal and reachable with a session.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadBanReason } from '@/lib/loaders/verification'
import { AuthPage } from '@/app/components/auth-frame'

export const metadata = { title: 'Account suspended', robots: { index: false, follow: false } }

export default async function BannedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Shared with GET /api/me (native clients): service client, own row only.
  const reason: string | null = user ? await loadBanReason(user.id) : null

  return (
    <AuthPage>
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>ACCOUNT</div>
      <h1 className="auth-form__title">Account suspended.</h1>
      <p className="auth-form__sub">Your account has been suspended for violating our terms. You can&rsquo;t browse, buy or sell while suspended.</p>
      {reason && <div className="kv"><span className="kv__k">REASON</span><span className="kv__v kv__v--dim">{reason}</span></div>}
      <div className="kv"><span className="kv__k">APPEAL</span><span className="kv__v kv__v--dim">WRITE TO SUPPORT WITH YOUR USERNAME</span></div>
      <Link href="/help" className="btn-ghost" style={{ marginTop: 18 }}>HELP &amp; FAQ →</Link>
    </AuthPage>
  )
}
