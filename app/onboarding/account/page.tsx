'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import GoogleButton from '@/app/enter/google-button'
import { GOOGLE_AUTH_ENABLED } from '@/lib/flags'

export default function AccountPage() {
  return (
    <Suspense>
      <AccountForm />
    </Suspense>
  )
}

function AccountForm() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Google users land here already authenticated but with no profile → username-only setup.
  const [oauthUser, setOauthUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    async function detectOauth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (!profile) {
        setOauthUser({ id: user.id, email: user.email ?? '' })
        // Confirmed-email signups arrive with the username they picked stashed in user
        // metadata (Google users have none). Prefill it so they only need to confirm.
        const metaUsername = (user.user_metadata?.username as string | undefined) ?? ''
        if (metaUsername) setUsername(metaUsername)
      }
    }
    detectOauth()
  }, [])

  function validUsername(u: string): boolean {
    if (!u.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      setError('username: 3–30 characters, letters/numbers/underscores only')
      return false
    }
    return true
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validUsername(username)) return
    if (password.length < 8) {
      setError('password must be at least 8 characters')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: { username: username.toLowerCase() },
      },
    })

    if (authError) {
      setLoading(false)
      setError(authError.message)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setLoading(false)
      setError('signup failed — please try again')
      return
    }

    // Without a session the client is still `anon`, so the insert below would fail the
    // insert-own-profile policy with a raw 42501. Happens if email confirmations are ever
    // enabled on the hosted project (they are off today, per supabase/config.toml).
    if (!authData.session) {
      setLoading(false)
      setError('check your email and open the link to confirm and finish setup')
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username: username.toLowerCase(),
    })

    if (profileError) {
      setLoading(false)
      // The auth user now exists but has no profile. Leaving the signup form mounted strands
      // them: re-submitting returns "User already registered" forever, and the log-in link
      // bounces back here via middleware's profile-exists redirect. Promoting them into the
      // username-only recovery state (the same one detectOauth builds on reload) lets them
      // retry the part that actually failed.
      setOauthUser({ id: userId, email: authData.user?.email ?? email.trim().toLowerCase() })
      if (profileError.code === '23505' && profileError.message.includes('username')) {
        setError('username already taken — pick another')
      } else if (profileError.code === '23505') {
        setError('profile already created — continue below')
      } else {
        setError(profileError.message)
      }
      return
    }

    setLoading(false)
    router.push('/onboarding/verify')
  }

  // Google user completing signup: create the profile (no password).
  async function handleOauthComplete(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!oauthUser) return
    if (!validUsername(username)) return

    setLoading(true)
    const supabase = createClient()
    const { error: profileError } = await supabase.from('profiles').insert({
      id: oauthUser.id,
      username: username.toLowerCase(),
    })
    if (profileError) {
      setLoading(false)
      // A 23505 here is either the username UNIQUE or the id PRIMARY KEY. Telling someone to
      // "pick another username" on a PK conflict sends them chasing a fix that cannot work.
      if (profileError.code === '23505' && profileError.message.includes('username')) {
        setError('username already taken — pick another')
      } else if (profileError.code === '23505') {
        setError('profile already created — continue below')
      } else {
        setError(profileError.message)
      }
      return
    }
    setLoading(false)
    router.push('/onboarding/verify')
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100svh', boxSizing: 'border-box', padding: '0 24px 40px' }}>
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>archive</span>
      </div>

      {oauthUser ? (
        /* ── Google user: pick a username to finish ── */
        <form onSubmit={handleOauthComplete} style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '480px', margin: '40px auto 0' }}>
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
            signed in as {oauthUser.email || 'your Google account'} — pick a username to finish.
          </div>
          <div>
            <FloatingInput label="Username" type="text" value={username}
              onChange={(v) => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(null) }}
              mono autoComplete="username" />
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              permanent — usernames are part of the record.
            </div>
          </div>
          {error && <div style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            height: '44px', background: 'var(--color-ink)', color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)', borderRadius: '2px',
            font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Finishing…' : 'Complete setup'}
          </button>
        </form>
      ) : (
        /* ── Email / password signup (+ Google) ── */
        <form onSubmit={handleSignup} style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '480px', margin: '40px auto 0' }}>
          <FloatingInput label="Email" type="email" value={email}
            onChange={(v) => { setEmail(v); setError(null) }} autoComplete="email" />

          <div>
            <FloatingInput label="Username" type="text" value={username}
              onChange={(v) => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(null) }}
              mono autoComplete="username" />
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              permanent — usernames are part of the record.
            </div>
          </div>

          <FloatingInput label="Password" type="password" value={password}
            onChange={(v) => { setPassword(v); setError(null) }} autoComplete="new-password" />

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--color-alert)' }}>
              {error}
              {error.toLowerCase().includes('already registered') && (
                <>
                  {' — '}
                  <a href="/enter/login" style={{ color: 'var(--color-ink)', textDecoration: 'underline' }}>log in instead</a>
                </>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            height: '44px', background: 'var(--color-ink)', color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)', borderRadius: '2px',
            font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          {GOOGLE_AUTH_ENABLED && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-ink-soft)', fontSize: '12px' }}>
                <span style={{ flex: 1, height: '1px', background: 'var(--color-line)' }} />
                OR
                <span style={{ flex: 1, height: '1px', background: 'var(--color-line)' }} />
              </div>
              <GoogleButton next="/browse" />
            </>
          )}
        </form>
      )}
    </div>
  )
}

function FloatingInput({ label, type, value, onChange, mono, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void
  mono?: boolean; autoComplete?: string
}) {
  return (
    <div style={{ position: 'relative', height: '44px', border: '1px solid var(--color-line)',
      borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
      <span style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)',
        padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
        {label}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)', fontSize: '14px', color: 'var(--color-ink)' }} />
    </div>
  )
}
