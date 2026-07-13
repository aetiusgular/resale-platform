'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('enter a valid email address')
      return
    }

    setError(null)
    setLoading(true)

    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setLoading(false)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'something went wrong — try again')
      return
    }

    setSubmitted(true)
  }

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
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            font: '600 16px var(--font-ui)',
            letterSpacing: '0.08em',
            color: 'var(--color-ink)',
          }}
        >
          ———
        </span>

        {submitted ? (
          <>
            <p
              style={{
                margin: '24px 0 0',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: '24px',
                lineHeight: 1.35,
                color: 'var(--color-ink)',
              }}
            >
              You&apos;re on the list.
            </p>
            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
              We&apos;ll reach out when a spot opens up.
            </p>
            <Link
              href="/enter"
              style={{ marginTop: '32px', fontSize: '13px', color: 'var(--color-ink)' }}
            >
              ← back
            </Link>
          </>
        ) : (
          <>
            <p
              style={{
                margin: '24px 0 0',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: '24px',
                lineHeight: 1.35,
                color: 'var(--color-ink)',
                maxWidth: '340px',
              }}
            >
              We&apos;ll let you know when a spot opens up.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: '40px',
                width: '100%',
                maxWidth: '360px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>
                <div
                  style={{
                    position: 'relative',
                    height: '44px',
                    border: `1px solid ${error ? 'var(--color-alert)' : 'var(--color-line)'}`,
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
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
                      color: error ? 'var(--color-alert)' : 'var(--color-ink-soft)',
                    }}
                  >
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null) }}
                    placeholder="you@example.com"
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      color: 'var(--color-ink)',
                    }}
                  />
                </div>
                {error && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '12px',
                      color: 'var(--color-alert)',
                      textAlign: 'left',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: '44px',
                  background: 'var(--color-ink)',
                  color: 'var(--color-bg)',
                  border: '1px solid var(--color-ink)',
                  borderRadius: '2px',
                  font: '500 14px var(--font-ui)',
                  letterSpacing: '-0.01em',
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Joining…' : 'Join waitlist'}
              </button>
            </form>

            <Link
              href="/enter"
              style={{ marginTop: '24px', fontSize: '13px', color: 'var(--color-ink)' }}
            >
              ← have a code?
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
