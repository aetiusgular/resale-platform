import { VERIFICATION_ENABLED } from '@/lib/flags'
import { createClient } from '@/lib/supabase/server'
import VerifyActions from './verify-actions'

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
  const badge = verified ? 'done' : 'pending'

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100svh', boxSizing: 'border-box', padding: '0 24px 40px' }}>
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span style={{ font: '600 15px var(--font-ui)', letterSpacing: '0.08em', color: 'var(--color-ink)' }}>archive</span>
      </div>

      <div style={{ marginTop: '40px', maxWidth: '480px', margin: '40px auto 0', border: '1px solid var(--color-line)', borderRadius: '2px' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
          {verified ? 'Verified — you’re all set' : 'Verify once, sell forever'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>1 · PHOTO ID</span>
          <StatusBadge status={badge} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderTop: '1px solid var(--color-line)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>2 · SELFIE MATCH</span>
          <StatusBadge status={badge} />
        </div>

        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--color-line)', fontSize: '12px', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
          {verified
            ? 'your identity is verified. you can buy, sell, and comment across the platform.'
            : pending
              ? 'verification in progress — this updates automatically once your check is reviewed. one-time check, no biometric storage.'
              : 'one-time check. no biometric storage. required to buy, sell, or comment — browsing works without it. it protects sellers as much as buyers: everyone you transact with is a real, accountable person.'}
        </div>
      </div>

      <VerifyActions enabled={VERIFICATION_ENABLED} verified={verified} />
    </div>
  )
}

function StatusBadge({ status }: { status: 'done' | 'pending' }) {
  const done = status === 'done'
  return (
    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 7px', border: `1px solid ${done ? 'var(--color-accent)' : 'var(--color-line)'}`, borderRadius: '2px', fontFamily: 'var(--font-mono)', fontWeight: done ? 700 : 400, fontSize: '9px', letterSpacing: '0.08em', color: done ? 'var(--color-accent)' : 'var(--color-ink-soft)', whiteSpace: 'nowrap' }}>
      {done ? 'DONE' : 'PENDING'}
    </span>
  )
}
