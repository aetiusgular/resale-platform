/**
 * /onboarding/verify — identity verification (step 03 of ACCOUNT → PREFERENCES → VERIFY,
 * mobile-web 24). Stripe Identity behind VERIFICATION_ENABLED; until then the button is
 * inert and the member can skip to browse. `?required=sell|payout` (the sell / payout
 * gates) sends a verified member back where they were going.
 */
import type { Metadata } from 'next'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { loadVerificationStatus } from '@/lib/loaders/verification'
import { createClient } from '@/lib/supabase/server'
import { AuthPage } from '@/app/components/auth-frame'
import StepRail from '../step-rail'
import VerifyActions from './verify-actions'

export const metadata: Metadata = { title: 'Verify your identity' }

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const { required } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ONE data assembly shared with GET /api/idv/status (native clients).
  const v = await loadVerificationStatus({ supabase, user, required })
  const { verified, pending, handle, after } = v
  const statusLabel = v.status_label

  return (
    <AuthPage onboarding cta={{ href: '/browse', label: handle || 'BROWSE FIRST →' }}>
      <StepRail current={3} />
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>IDENTITY VERIFICATION</div>
      <h1 className="auth-form__title">{verified ? 'Verified — you’re all set.' : 'One person, one account.'}</h1>
      <p className="auth-form__sub">
        {verified
          ? 'Your identity is verified. You can buy, sell and take part in legit checks across the platform.'
          : pending
            ? 'Verification in progress — this updates automatically once your check is reviewed. One-time check, no biometric storage.'
            : 'Verified members get the badge buyers filter for. Required before your first sale — optional for browsing and buying. One-time check, no biometric storage.'}
      </p>
      <div className="idv-box">
        <div className="idv-box__row"><span className="idv-box__k">GOVERNMENT ID</span><span className="idv-box__v">PASSPORT · LICENSE · NATIONAL ID</span></div>
        <div className="idv-box__row"><span className="idv-box__k">LIVE SELFIE</span><span className="idv-box__v">MATCHED TO YOUR ID</span></div>
        <div className="idv-box__row"><span className="idv-box__k">TIME</span><span className="idv-box__v">≈ 2 MINUTES — VIA STRIPE IDENTITY</span></div>
      </div>
      <div className="idv-status">
        <span className="idv-status__k">STATUS</span>
        <span className={`tag${verified ? ' tag--ink' : ''}`} data-testid="idv-status">{statusLabel}</span>
      </div>
      <div className="auth-form__hint" style={{ paddingTop: 14 }}>ENCRYPTED — NEVER SHOWN TO OTHER MEMBERS.</div>
      <VerifyActions enabled={VERIFICATION_ENABLED} verified={verified} after={after} />
    </AuthPage>
  )
}
