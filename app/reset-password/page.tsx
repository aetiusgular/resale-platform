'use client'

/**
 * /reset-password — set a new password. Reached after the reset link's code is exchanged
 * by /api/auth/callback, so the visitor arrives with a (recovery) session. updateUser also
 * works for a Google-first account that never had a password — this is how it gains one.
 * Public route (see middleware PUBLIC_PATHS) so an expired or cold-opened link still renders
 * the "request a new link" message instead of bouncing to /enter.
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { AuthPage } from '@/app/components/auth-frame'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null) // null = checking session
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('password must be at least 8 characters'); return }
    if (password !== confirm) { setError('passwords do not match'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    setDone(true)
    setTimeout(() => { router.push('/browse'); router.refresh() }, 1200)
  }

  return (
    <AuthPage cta={{ href: '/enter/login', label: 'BACK TO SIGN IN →' }}>
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>SET A NEW PASSWORD</div>
      {ready === null ? (
        <div className="mono-note">LOADING…</div>
      ) : ready === false ? (
        <>
          <h1 className="auth-form__title">This link has expired.</h1>
          <p className="auth-form__sub">Reset links are single-use and time-limited. Request a fresh one and open it on this device.</p>
          <Link href="/enter/forgot" className="btn-primary" style={{ marginTop: 0 }}>REQUEST A NEW LINK →</Link>
        </>
      ) : done ? (
        <>
          <h1 className="auth-form__title">Password updated.</h1>
          <p className="auth-form__sub">Taking you in…</p>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <h1 className="auth-form__title" style={{ paddingBottom: 20 }}>Choose a new password.</h1>
          <label className="field-label" htmlFor="reset-password">NEW PASSWORD</label>
          <input id="reset-password" className="input-mono" type="password" placeholder="Min 8 characters" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
          <label className="field-label" htmlFor="reset-confirm" style={{ paddingTop: 16, display: 'block' }}>CONFIRM PASSWORD</label>
          <input id="reset-confirm" className="input-mono" type="password" placeholder="Same again" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null) }} />
          <div className="auth-form__hint">MIN 8 CHARACTERS</div>
          {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
          <button type="submit" className="btn-primary" disabled={loading || !password || !confirm}>
            {loading ? 'SAVING…' : 'SET PASSWORD →'}
          </button>
        </form>
      )}
    </AuthPage>
  )
}
