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
    <div style={{ background: 'var(--color-bg)', minHeight: '100svh', boxSizing: 'border-box', padding: '0 24px 40px' }}>
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>archive</span>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>
          RESET PASSWORD
        </div>
      </div>

      {sent ? (
        <div style={{ maxWidth: '480px', margin: '40px auto 0', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
            If an account exists for {email.trim().toLowerCase()}, a reset link is on its way. Open it to set a new password.
          </p>
          <Link href="/enter/login" style={{ fontSize: '13px', color: 'var(--color-ink)', textDecoration: 'underline' }}>
            back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: '480px', margin: '40px auto 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
            Enter your email and we&apos;ll send a link to set a new password. Signed up with Google? Use this to add a password to your account.
          </p>
          <FloatingInput label="Email" type="email" value={email}
            onChange={(v) => { setEmail(v); setError(null) }} autoComplete="email" />
          {error && <div style={{ fontSize: '14px', color: 'var(--color-alert)' }}>{error}</div>}
          <button type="submit" disabled={loading || !email}
            style={{ height: '44px', border: 'none', borderRadius: '2px', background: 'var(--color-ink)',
              color: 'var(--color-bg)', font: '500 15px var(--font-ui)', cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !email ? 0.6 : 1 }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
            remembered it?{' '}
            <Link href="/enter/login" style={{ color: 'var(--color-ink)', textDecoration: 'underline' }}>
              log in
            </Link>
          </div>
        </form>
      )}
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
