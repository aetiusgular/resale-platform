'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import SocialAuthButtons from '@/app/components/social-auth-buttons'

export default function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (signInError) {
      setLoading(false)
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'wrong email or password'
          : signInError.message === 'Email not confirmed'
            ? 'check your email to confirm your address before logging in'
            : signInError.message,
      )
      return
    }
    router.push('/browse')
    router.refresh()
  }

  return (
    <form onSubmit={handleLogin}>
      <h1 className="auth-form__title" style={{ paddingBottom: 26 }}>Sign in</h1>
      <label className="field-label" htmlFor="login-email">EMAIL</label>
      <input id="login-email" className="input-mono" type="email" placeholder="you@email.com" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
      <div className="field-label field-label--row" style={{ paddingTop: 16 }}>
        <label htmlFor="login-password">PASSWORD</label>
        <Link className="link-underline link-underline--sm" href="/enter/forgot">FORGOT?</Link>
      </div>
      <input id="login-password" className="input-mono" type="password" placeholder="Your password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
      <button type="submit" className="btn-primary" disabled={loading || !email || !password}>
        {loading ? 'SIGNING IN…' : 'SIGN IN →'}
      </button>
      <div className="or-rule"><span /><em>OR</em><span /></div>
      <SocialAuthButtons next="/browse" />
      <div className="auth-form__swap">
        <span className="page-note">NEW TO ARCHIVE?</span>
        <Link className="auth-form__swap-link" href="/enter">CREATE ACCOUNT →</Link>
      </div>
    </form>
  )
}
