'use client'

/**
 * "Continue with Apple" — Supabase OAuth (Apple). Mirrors google-button.tsx exactly:
 * kicks off the OAuth redirect to /api/auth/callback (forwarding `next`); the callback
 * exchanges the code for a session and routes existing profile → `next`, new user →
 * onboarding to pick a username.
 *
 * SHIPS DARK: rendered only when APPLE_AUTH_ENABLED. Enabling it also needs the Apple
 * provider configured in Supabase (Service ID + signing key), which requires an Apple
 * Developer account. Until then this component never renders.
 */
import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function AppleButton({ next = '/browse' }: { next?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const params = new URLSearchParams({ next })
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?${params.toString()}` },
    })
    if (oauthError) {
      setLoading(false)
      setError(oauthError.message)
    }
    // On success the browser redirects to Apple; nothing else to do here.
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        style={{
          height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: 'var(--color-bg)', color: 'var(--color-ink)',
          border: '1px solid var(--color-ink)', borderRadius: '2px',
          font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, width: '100%',
        }}
      >
        <svg width="15" height="18" viewBox="0 0 14 17" aria-hidden="true" fill="currentColor">
          <path d="M11.6 9.03c-.02-1.86 1.52-2.75 1.59-2.8-.87-1.27-2.22-1.44-2.7-1.46-1.15-.12-2.24.68-2.83.68-.58 0-1.48-.66-2.43-.65-1.25.02-2.4.73-3.05 1.85-1.3 2.25-.33 5.58.93 7.4.62.9 1.36 1.9 2.32 1.86.93-.04 1.28-.6 2.4-.6 1.12 0 1.44.6 2.42.58 1-.02 1.63-.91 2.24-1.81.71-1.04 1-2.05 1.01-2.1-.02-.01-1.94-.75-1.96-2.95zM9.77 3.5c.51-.62.86-1.49.76-2.35-.74.03-1.63.49-2.16 1.11-.47.55-.89 1.43-.78 2.27.82.07 1.66-.42 2.18-1.03z"/>
        </svg>
        {loading ? 'Redirecting…' : 'Continue with Apple'}
      </button>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-alert)' }}>{error}</span>}
    </div>
  )
}
