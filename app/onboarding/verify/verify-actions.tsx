'use client'

/**
 * Client actions for the verify page. `enabled` (VERIFICATION_ENABLED) and `verified`
 * (the user's real status) are resolved on the SERVER and passed in, so server and client
 * render identically — no hydration mismatch.
 */
import { useRouter } from 'next/navigation'

export default function VerifyActions({ enabled, verified }: { enabled: boolean; verified: boolean }) {
  const router = useRouter()

  if (verified) {
    return (
      <>
        <button type="button" className="btn-primary" onClick={() => router.push('/onboarding/setup')}>CONTINUE →</button>
        <div className="auth-form__hint">NEXT: YOUR SIZES AND WHAT YOU COLLECT</div>
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        disabled={!enabled}
        onClick={() => { if (enabled) window.location.href = '/api/idv/start' }}
        title={!enabled ? 'Coming in beta' : undefined}
      >
        {enabled ? 'VERIFY NOW →' : 'VERIFY NOW · COMING IN BETA'}
      </button>
      <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={() => router.push('/onboarding/setup')} data-testid="verify-skip">
        SKIP FOR NOW — BROWSE AND BUY
      </button>
      <div className="auth-form__hint">YOU CAN VERIFY LATER FROM SETTINGS BEFORE YOUR FIRST LISTING</div>
    </>
  )
}
