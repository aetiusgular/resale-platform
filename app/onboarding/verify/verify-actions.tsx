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
      <div style={{ marginTop: '24px', maxWidth: '480px', margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '44px', padding: '0 20px', border: '1px solid var(--color-accent)', borderRadius: '2px', color: 'var(--color-accent)', font: '500 14px var(--font-ui)' }}>
          ✓ Verified
        </div>
        <button
          onClick={() => router.push('/')}
          style={{ font: '500 13px var(--font-ui)', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          continue
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '24px', maxWidth: '480px', margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <button
        disabled={!enabled}
        onClick={() => { if (enabled) window.location.href = '/api/idv/start' }}
        title={!enabled ? 'coming in beta' : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%',
          background: enabled ? 'var(--color-ink)' : 'var(--color-line)',
          color: enabled ? 'var(--color-bg)' : 'var(--color-ink-soft)',
          border: `1px solid ${enabled ? 'var(--color-ink)' : 'var(--color-line)'}`,
          borderRadius: '2px', font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
          cursor: enabled ? 'pointer' : 'not-allowed',
        }}
      >
        Verify now
        {!enabled && (
          <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}>· COMING IN BETA</span>
        )}
      </button>
      <button
        onClick={() => router.push('/onboarding/setup')}
        style={{ font: '500 13px var(--font-ui)', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        skip for now — browse only
      </button>
    </div>
  )
}
