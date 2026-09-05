/**
 * /onboarding/verify — identity verification handoff (step 2 of onboarding).
 * ID check is behind VERIFICATION_ENABLED; until then the button is inert and
 * the member can skip to setup.
 */
import type { Metadata } from 'next'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { createClient } from '@/lib/supabase/server'
import { AuthPage } from '@/app/components/auth-frame'
import VerifyActions from './verify-actions'

export const metadata: Metadata = { title: 'Verify your identity' }

export default async function VerifyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let status: string | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id_verification_status')
      .eq('id', user.id)
      .single()
    status = (data as { id_verification_status?: string } | null)?.id_verification_status ?? null
  }
  const verified = status === 'verified'
  const pending = status === 'pending'

  return (
    <AuthPage cta={{ href: '/browse', label: 'BROWSE FIRST →' }}>
      <div className="step-list">
        <span className="step-list__item is-done">01 ACCOUNT</span>
        <span className="step-list__item is-on">02 VERIFY</span>
        <span className="step-list__item">03 SIZES</span>
      </div>
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>IDENTITY</div>
      <h1 className="auth-form__title">{verified ? 'Verified — you’re all set.' : 'Verify once, sell forever.'}</h1>
      <p className="auth-form__sub">
        {verified
          ? 'Your identity is verified. You can buy, sell and take part in legit checks across the platform.'
          : pending
            ? 'Verification in progress — this updates automatically once your check is reviewed. One-time check, no biometric storage.'
            : 'One-time check, no biometric storage. Required to sell — browsing and buying work without it. It protects sellers as much as buyers: everyone you transact with is a real, accountable person.'}
      </p>
      <div className="kv"><span className="kv__k">1 · PHOTO ID</span><span className={`tag${verified ? ' tag--ink' : ''}`}>{verified ? 'DONE' : pending ? 'IN REVIEW' : 'PENDING'}</span></div>
      <div className="kv"><span className="kv__k">2 · SELFIE MATCH</span><span className={`tag${verified ? ' tag--ink' : ''}`}>{verified ? 'DONE' : pending ? 'IN REVIEW' : 'PENDING'}</span></div>
      <VerifyActions enabled={VERIFICATION_ENABLED} verified={verified} />
    </AuthPage>
  )
}
