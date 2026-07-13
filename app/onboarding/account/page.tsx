'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { normalizeCode } from '@/lib/invite-codes'

export default function AccountPage() {
  return (
    <Suspense>
      <AccountForm />
    </Suspense>
  )
}

function AccountForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeParam = searchParams.get('code') ?? ''

  const [invitedBy, setInvitedBy] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!codeParam) return
    async function resolveInviter() {
      const supabase = createClient()
      const { data: codeRow } = await supabase
        .from('invite_codes')
        .select('generated_by')
        .eq('code', normalizeCode(codeParam))
        .single()
      if (codeRow?.generated_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', codeRow.generated_by)
          .single()
        if (profile?.username) setInvitedBy(profile.username as string)
      }
    }
    resolveInviter()
  }, [codeParam])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      setError('username: 3–30 characters, letters/numbers/underscores only')
      return
    }
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
        emailRedirectTo: `${window.location.origin}/onboarding/verify`,
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

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username: username.toLowerCase(),
    })

    if (profileError) {
      setLoading(false)
      if (profileError.message.includes('unique') || profileError.code === '23505') {
        setError('username already taken — pick another')
      } else {
        setError(profileError.message)
      }
      return
    }

    if (codeParam) {
      const { data: claimData, error: claimError } = await supabase.rpc('claim_invite_code', {
        p_code: normalizeCode(codeParam),
      })
      if (claimError) {
        console.error('[claim_invite_code]', claimError)
      } else if (claimData && !claimData.success) {
        console.error('[claim_invite_code] failed:', claimData.error)
      }
    }

    setLoading(false)
    router.push('/onboarding/verify')
  }

  const normalizedCode = normalizeCode(codeParam)

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        boxSizing: 'border-box',
        padding: '0 24px 40px',
      }}
    >
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>
          ———
        </span>
        {codeParam && (
          <div
            style={{
              marginTop: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: 'var(--color-ink-soft)',
              textTransform: 'uppercase',
            }}
          >
            CODE {normalizedCode} ACCEPTED
            {invitedBy ? ` · INVITED BY @${invitedBy.toUpperCase()}` : ''}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSignup}
        style={{
          marginTop: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '480px',
          margin: '40px auto 0',
        }}
      >
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
          <div style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{
          height: '44px', background: 'var(--color-ink)', color: 'var(--color-bg)',
          border: '1px solid var(--color-ink)', borderRadius: '2px',
          font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
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
