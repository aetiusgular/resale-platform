'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { normalizeCode, isValidCodeFormat } from '@/lib/invite-codes'

type EnterError = 'code not found' | 'code already used' | 'cannot claim your own code' | 'invalid format' | string

function errorMessage(err: EnterError): string {
  if (err === 'code not found') return 'code not found'
  if (err === 'code already used') return 'code already used'
  if (err === 'cannot claim your own code') return 'that code is yours — share it with a friend'
  if (err === 'invalid format') return 'codes look like XXXX-XXXX'
  return err
}

export default function EnterPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEnter(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizeCode(code)

    if (!isValidCodeFormat(normalized)) {
      setError('invalid format')
      return
    }

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Not signed in yet — store code in sessionStorage then redirect to signup
      sessionStorage.setItem('pending_invite_code', normalized)
      router.push('/onboarding/account?code=' + encodeURIComponent(normalized))
      return
    }

    // Already signed in — claim the code directly
    const { data, error: rpcError } = await supabase.rpc('claim_invite_code', {
      p_code: normalized,
    })

    setLoading(false)

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'something went wrong')
      return
    }

    const result = data as { success: boolean; error: string | null }
    if (!result.success) {
      setError(result.error ?? 'something went wrong')
      return
    }

    router.push('/onboarding/codes')
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    // Auto-insert hyphen at position 4
    let formatted = raw.replace(/-/g, '')
    if (formatted.length > 4) {
      formatted = formatted.slice(0, 4) + '-' + formatted.slice(4, 8)
    }
    setCode(formatted)
    if (error) setError(null)
  }

  const hasError = Boolean(error)

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 32px',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          textAlign: 'center',
        }}
      >
        {/* Wordmark dash */}
        <span
          style={{
            font: '600 16px var(--font-ui)',
            letterSpacing: '0.08em',
            color: 'var(--color-ink)',
          }}
        >
          ———
        </span>

        {/* Tagline */}
        <p
          style={{
            margin: '24px 0 0',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '28px',
            lineHeight: 1.35,
            color: 'var(--color-ink)',
            maxWidth: '400px',
          }}
        >
          A quieter market for the things worth keeping.
        </p>

        {/* Form */}
        <form
          onSubmit={handleEnter}
          style={{
            marginTop: '48px',
            width: '100%',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Code input */}
          <div>
            <div
              style={{
                position: 'relative',
                height: '44px',
                border: `1px solid ${hasError ? 'var(--color-alert)' : 'var(--color-line)'}`,
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 12px',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: '6px',
                  top: '-7px',
                  background: 'var(--color-bg)',
                  padding: '0 4px',
                  font: '500 12px var(--font-ui)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: hasError ? 'var(--color-alert)' : 'var(--color-ink-soft)',
                }}
              >
                Invite code
              </span>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={handleInput}
                placeholder="····-····"
                maxLength={9}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink)',
                  textAlign: 'center',
                }}
              />
            </div>
            {hasError && (
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '12px',
                  color: 'var(--color-alert)',
                  textAlign: 'left',
                }}
              >
                {errorMessage(error!)}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '44px',
              width: '100%',
              background: 'var(--color-ink)',
              color: 'var(--color-bg)',
              border: '1px solid var(--color-ink)',
              borderRadius: '2px',
              font: '500 14px var(--font-ui)',
              letterSpacing: '-0.01em',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 120ms linear',
            }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>

        <Link
          href="/enter/waitlist"
          style={{
            marginTop: '20px',
            fontSize: '13px',
            color: 'var(--color-ink)',
          }}
        >
          no code? join the waitlist
        </Link>

        <Link
          href="/enter/login"
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--color-ink-soft)',
          }}
        >
          already a member? log in
        </Link>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '24px 0 28px',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        {['About', 'Terms', 'Privacy'].map((label) => (
          <span
            key={label}
            style={{
              font: '500 11px var(--font-ui)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-soft)',
              cursor: 'pointer',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
