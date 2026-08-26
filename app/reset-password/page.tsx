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
    <div style={{ background: 'var(--color-bg)', minHeight: '100svh', boxSizing: 'border-box', padding: '0 24px 40px' }}>
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>———</span>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>
          SET A NEW PASSWORD
        </div>
      </div>

      {ready === null ? (
        <div style={{ marginTop: '48px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>LOADING…</div>
      ) : ready === false ? (
        <div style={{ maxWidth: '480px', margin: '40px auto 0', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
            This reset link is invalid or has expired.
          </p>
          <Link href="/enter/forgot" style={{ fontSize: '13px', color: 'var(--color-ink)', textDecoration: 'underline' }}>
            request a new link
          </Link>
        </div>
      ) : done ? (
        <div style={{ marginTop: '48px', textAlign: 'center', fontSize: '14px', color: 'var(--color-ink)' }}>
          Password updated — taking you in…
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: '480px', margin: '40px auto 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <FloatingInput label="New password" type="password" value={password}
            onChange={(v) => { setPassword(v); setError(null) }} autoComplete="new-password" />
          <FloatingInput label="Confirm password" type="password" value={confirm}
            onChange={(v) => { setConfirm(v); setError(null) }} autoComplete="new-password" />
          {error && <div style={{ fontSize: '14px', color: 'var(--color-alert)' }}>{error}</div>}
          <button type="submit" disabled={loading || !password || !confirm}
            style={{ height: '44px', border: 'none', borderRadius: '2px', background: 'var(--color-ink)',
              color: 'var(--color-bg)', font: '500 15px var(--font-ui)', cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !password || !confirm ? 0.6 : 1 }}>
            {loading ? 'Saving…' : 'Set password'}
          </button>
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
