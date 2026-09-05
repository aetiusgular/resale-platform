'use client'

/**
 * Client actions for the verify page (mobile-web 24: START VERIFICATION → over
 * VERIFY LATER — BROWSE →). `enabled` (VERIFICATION_ENABLED) and `verified` (the user's
 * real status) are resolved on the SERVER and passed in, so server and client render
 * identically — no hydration mismatch. `after` is where a verified member continues
 * (the sell / payout gate that sent them here, else browse).
 */
import { useRouter } from 'next/navigation'

export default function VerifyActions({ enabled, verified, after = '/browse' }: { enabled: boolean; verified: boolean; after?: string }) {
  const router = useRouter()

  if (verified) {
    return (
      <div className="onb-cta">
        <button type="button" className="btn-primary" onClick={() => router.push(after)}>CONTINUE →</button>
      </div>
    )
  }

  return (
    <div className="onb-cta">
      <button
        type="button"
        className="btn-primary"
        disabled={!enabled}
        onClick={() => { if (enabled) window.location.href = '/api/idv/start' }}
        title={!enabled ? 'Coming in beta' : undefined}
      >
        {enabled ? 'START VERIFICATION →' : 'START VERIFICATION · COMING IN BETA'}
      </button>
      <button type="button" className="link-underline onb-cta__skip" onClick={() => router.push('/browse')} data-testid="verify-skip">
        VERIFY LATER — BROWSE →
      </button>
      <div className="auth-form__hint">YOU CAN VERIFY LATER FROM SETTINGS BEFORE YOUR FIRST LISTING</div>
    </div>
  )
}
