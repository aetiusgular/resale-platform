'use client'

/**
 * AuthModal — the sign-in / sign-up popup that replaces the full-page /enter/login
 * flow as the primary entry. Opened by useAuthModal().openAuthModal() (header "Sign in"
 * and every guarded write action for guests). Mirrors app/enter/login/page.tsx: email +
 * password sign-in, Google, Apple, and a link into the full create-account flow.
 *
 * `next` is where OAuth returns after login (the page the guest was on). Email sign-in
 * keeps them in place: on success we close and router.refresh() so the same page
 * re-renders with the session, and the action they clicked becomes available.
 *
 * The full /enter and /enter/login routes still exist as a fallback (deep links, the
 * OAuth return, no-JS) — this is the primary path, not the only one.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import GoogleButton from '@/app/enter/google-button'
import AppleButton from '@/app/enter/apple-button'
import { GOOGLE_AUTH_ENABLED, APPLE_AUTH_ENABLED } from '@/lib/flags'

export default function AuthModal({ next, onClose }: { next: string; onClose: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
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
    // Signed in — close and re-render the current page with the session so the
    // guarded action becomes available.
    onClose()
    router.refresh()
  }

  const hasSocial = GOOGLE_AUTH_ENABLED || APPLE_AUTH_ENABLED

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--color-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: '420px',
          background: 'var(--color-bg)', border: '1px solid var(--color-ink)',
          borderRadius: '2px', boxShadow: 'var(--shadow-1)',
          padding: '40px 28px 28px', boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '10px', right: '12px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '20px', lineHeight: 1, color: 'var(--color-ink-soft)',
            width: '44px', height: '44px',
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
          <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>
            SIGN IN TO CONTINUE
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ModalInput label="Email" type="email" value={email}
            onChange={(v) => { setEmail(v); setError(null) }} autoComplete="email" />
          <ModalInput label="Password" type="password" value={password}
            onChange={(v) => { setPassword(v); setError(null) }} autoComplete="current-password" />

          <div style={{ marginTop: '-12px', textAlign: 'right' }}>
            <Link href="/enter/forgot" onClick={onClose} style={{ fontSize: '12px', color: 'var(--color-ink-soft)', textDecoration: 'underline' }}>
              forgot password?
            </Link>
          </div>

          {error && <div style={{ fontSize: '14px', color: 'var(--color-alert)' }}>{error}</div>}

          <button type="submit" disabled={loading || !email || !password}
            style={{ height: '44px', border: 'none', borderRadius: '2px', background: 'var(--color-ink)',
              color: 'var(--color-bg)', font: '500 15px var(--font-ui)', cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !email || !password ? 0.6 : 1 }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>

          {hasSocial && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-ink-soft)', fontSize: '12px' }}>
              <span style={{ flex: 1, height: '1px', background: 'var(--color-line)' }} />
              OR
              <span style={{ flex: 1, height: '1px', background: 'var(--color-line)' }} />
            </div>
          )}
          {GOOGLE_AUTH_ENABLED && <GoogleButton next={next} />}
          {APPLE_AUTH_ENABLED && <AppleButton next={next} />}

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
            new here?{' '}
            <Link href="/onboarding/account" onClick={onClose} style={{ color: 'var(--color-ink)', textDecoration: 'underline' }}>
              create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalInput({ label, type, value, onChange, autoComplete }: {
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
