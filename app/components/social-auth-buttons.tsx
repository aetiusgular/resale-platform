'use client'

/**
 * Social auth buttons — Sign Up Pages 3A/3B/3C handoff (Sept 2026 review).
 *
 *   variant="stacked" — full-width CONTINUE WITH GOOGLE / CONTINUE WITH APPLE rows with the
 *                       brand marks (desktop modal + auth pages, option 01).
 *   variant="split"   — GOOGLE | APPLE side by side (mobile sheet, option 04).
 *   variant="auto"    — stacked, split at ≤720px (default).
 *
 * Both providers are part of the design and always render (the handoff adds Apple to the
 * desktop rows); NEXT_PUBLIC_GOOGLE_AUTH_ENABLED / NEXT_PUBLIC_APPLE_AUTH_ENABLED no longer
 * hide them. A click starts the Supabase OAuth redirect to /api/auth/callback?next=… — the
 * callback exchanges the code for a session and routes an existing profile to `next`, a new
 * user to /onboarding/account (username derived from the email). A provider that is not
 * enabled in the Supabase project bounces back through the callback, which lands on
 * /enter/login?error=oauth with the provider's reason (docs/GOOGLE_OAUTH_SETUP.md; Apple
 * also needs the Service ID + signing key). The inline line below only catches a failure
 * to start the redirect.
 *
 * Marks: the SVG paths come from the handoff's SocialAuthButtons.tsx. Google's is the
 * four-colour G; Apple's uses currentColor so it follows the theme.
 */
import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useCompact } from './use-compact'

type Provider = 'google' | 'apple'

export function GoogleMark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function AppleMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.99-.2 1.94-.9 3.28-.8 1.6.13 2.8.76 3.6 1.9-3.3 1.98-2.52 6.32.5 7.44-.6 1.58-1.38 3.15-2.46 4.63zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

export default function SocialAuthButtons({ next = '/browse', variant = 'auto' }: {
  /** Where OAuth lands afterwards (the page the guest was on). */
  next?: string
  variant?: 'stacked' | 'split' | 'auto'
}) {
  const compact = useCompact()
  const split = variant === 'split' || (variant === 'auto' && compact)
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signIn(provider: Provider) {
    setPending(provider)
    setError(null)
    const supabase = createClient()
    const params = new URLSearchParams({ next })
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback?${params.toString()}` },
    })
    // On success the browser leaves for the provider; only an error comes back here.
    if (oauthError) {
      setPending(null)
      setError(oauthError.message.toUpperCase())
    }
  }

  const label = (provider: Provider, name: string) =>
    pending === provider ? 'REDIRECTING…' : split ? name : `CONTINUE WITH ${name}`

  return (
    <div>
      <div className={split ? 'social-split' : 'social-stack'} data-testid="social-auth">
        <button type="button" className="btn-social" onClick={() => signIn('google')} disabled={pending !== null} data-testid="social-google">
          <GoogleMark size={split ? 14 : 15} />
          <span>{label('google', 'GOOGLE')}</span>
        </button>
        <button type="button" className="btn-social" onClick={() => signIn('apple')} disabled={pending !== null} data-testid="social-apple">
          <AppleMark size={14} />
          <span>{label('apple', 'APPLE')}</span>
        </button>
      </div>
      {error && <div className="alert-line" role="alert">{error}</div>}
    </div>
  )
}
