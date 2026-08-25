'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import GoogleButton from '@/app/enter/google-button'
import { GOOGLE_AUTH_ENABLED } from '@/lib/flags'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'oauth') {
      setError('Google sign-in failed — please try again.')
    }
  }, [])

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
          : signInError.message
      )
      return
    }
    router.push('/browse')
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100svh', boxSizing: 'border-box', padding: '0 24px 40px' }}>
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>
          MEMBER LOGIN
        </div>
      </div>

      <form onSubmit={handleLogin}
        style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '480px', margin: '40px auto 0' }}>
        <FloatingInput label="Email" type="email" value={email}
          onChange={(v) => { setEmail(v); setError(null) }} autoComplete="email" />
        <FloatingInput label="Password" type="password" value={password}
          onChange={(v) => { setPassword(v); setError(null) }} autoComplete="current-password" />

        {error && (
          <div style={{ fontSize: '14px', color: 'var(--color-alert)' }}>{error}</div>
        )}

        <button type="submit" disabled={loading || !email || !password}
          style={{ height: '44px', border: 'none', borderRadius: '2px', background: 'var(--color-ink)',
            color: 'var(--color-bg)', font: '500 15px var(--font-ui)', cursor: loading ? 'wait' : 'pointer',
            opacity: loading || !email || !password ? 0.6 : 1 }}>
          {loading ? 'Logging in…' : 'Log in'}
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

        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
          new here?{' '}
          <Link href="/onboarding/account" style={{ color: 'var(--color-ink)', textDecoration: 'underline' }}>
            create an account
          </Link>
        </div>
      </form>
    </div>
  )
}

function FloatingInput({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; autoComplete?: string
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
          fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--color-ink)' }} />
    </div>
  )
}
