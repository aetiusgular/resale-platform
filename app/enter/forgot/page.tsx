'use client'

/**
 * /enter/forgot — request a password-reset link. Works for ANY account with this email,
 * including Google-first users, who use it to SET a password for the first time (adding
 * email+password login to their existing OAuth account). We always show the same neutral
 * confirmation regardless of whether the email exists, so the page can't be used to probe
 * for accounts. The link returns through /api/auth/callback, which exchanges the code for a
 * session and lands the user on /reset-password to choose the new password.
 */
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { AuthPage } from '@/app/components/auth-frame'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password` },
    )
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthPage cta={{ href: '/enter/login', label: 'BACK TO SIGN IN →' }}>
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>RESET PASSWORD</div>
      {sent ? (
        <>
          <h1 className="auth-form__title">Check your inbox.</h1>
          <p className="auth-form__sub">If an account exists for {email.trim().toLowerCase()}, a reset link is on its way. Open it to set a new password.</p>
          <div className="auth-form__swap">
            <span className="page-note">REMEMBERED IT?</span>
            <Link className="auth-form__swap-link" href="/enter/login">SIGN IN →</Link>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <h1 className="auth-form__title">Set a new password.</h1>
          <p className="auth-form__sub">Enter your email and we&rsquo;ll send a link to set a new password. Signed up with Google? Use this to add a password to your account.</p>
          <label className="field-label" htmlFor="forgot-email">EMAIL</label>
          <input id="forgot-email" className="input-mono" type="email" placeholder="you@email.com" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
          {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
          <button type="submit" className="btn-primary" disabled={loading || !email}>
            {loading ? 'SENDING…' : 'SEND RESET LINK →'}
          </button>
          <div className="auth-form__swap">
            <span className="page-note">REMEMBERED IT?</span>
            <Link className="auth-form__swap-link" href="/enter/login">SIGN IN →</Link>
          </div>
        </form>
      )}
    </AuthPage>
  )
}
