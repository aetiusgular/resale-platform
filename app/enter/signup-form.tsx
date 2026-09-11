'use client'

/**
 * Create-account form (reference SignupPage, option 1A): email + password only.
 * The username is generated from the email (changeable 1× / 30 days in
 * Settings) and the profile row is created right after sign-up; the new member
 * lands on `next` (default /browse). Shared by /enter and the auth modal.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { passwordProblem, randomSuffix, usernameFromEmail } from '@/lib/auth/username'
import SocialAuthButtons from '@/app/components/social-auth-buttons'

/** Insert the profile with a derived username, retrying on a username collision. */
export async function createProfileForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const username = usernameFromEmail(email, attempt === 0 ? undefined : randomSuffix())
    const { error } = await supabase.from('profiles').insert({ id: userId, username })
    if (!error) return { ok: true, username }
    if (error.code === '23505' && error.message.includes('username')) continue
    if (error.code === '23505') return { ok: true, username }
    return { ok: false, error: error.message }
  }
  return { ok: false, error: 'Could not pick a username — try again.' }
}

export default function SignupForm({ next = '/browse', compact = false, onDone }: { next?: string; compact?: boolean; onDone?: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setError('ENTER A VALID EMAIL'); return }
    const pwProblem = passwordProblem(password)
    if (pwProblem) { setError(pwProblem); return }

    setLoading(true)
    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: clean,
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (authError) {
      setLoading(false)
      setError(authError.message.toUpperCase())
      return
    }
    const userId = authData.user?.id
    if (!userId) { setLoading(false); setError('SIGNUP FAILED — PLEASE TRY AGAIN'); return }
    // Without a session the client is still `anon`, so the profile insert would fail
    // the insert-own-profile policy. Happens only if email confirmations are on.
    if (!authData.session) {
      setLoading(false)
      setError('CHECK YOUR EMAIL AND OPEN THE LINK TO CONFIRM AND FINISH SETUP')
      return
    }
    const created = await createProfileForUser(supabase, userId, clean)
    setLoading(false)
    if (!created.ok) { setError(created.error.toUpperCase()); return }
    onDone?.()
    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSignup} data-testid="signup-form">
      {!compact && (
        <h1 className="auth-form__title">Create account</h1>
      )}
      <label className="field-label" htmlFor="signup-email">EMAIL</label>
      <input id="signup-email" className="input-mono" type="email" placeholder="you@email.com" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} />
      <label className="field-label" htmlFor="signup-password" style={{ paddingTop: compact ? 14 : 16, display: 'block' }}>PASSWORD</label>
      <input id="signup-password" className="input-mono" type="password" placeholder="Min 10 characters" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
      <div className="auth-form__hint">MIN 10 CHARACTERS · AT LEAST 1 NUMBER</div>
      {error && (
        <div className="alert-line" role="alert">
          {error}
          {error.toLowerCase().includes('already registered') && (
            <> — <Link href="/enter/login" style={{ textDecoration: 'underline' }} onClick={onDone}>SIGN IN INSTEAD</Link></>
          )}
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={loading} data-testid="signup-submit">
        {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT →'}
      </button>
      <div className="or-rule"><span /><em>OR</em><span /></div>
      <SocialAuthButtons next={next} />
      {compact && (
        <div className="legal-line">
          BY CONTINUING YOU AGREE TO THE <Link href="/terms" onClick={onDone}>TERMS</Link> &amp; <Link href="/privacy" onClick={onDone}>PRIVACY POLICY</Link>.
        </div>
      )}
      {!compact && (
        <div className="auth-form__swap">
          <span className="page-note">ALREADY A MEMBER?</span>
          <Link className="auth-form__swap-link" href="/enter/login" data-testid="enter-login" aria-label="Already a member? Sign in">SIGN IN →</Link>
        </div>
      )}
    </form>
  )
}
