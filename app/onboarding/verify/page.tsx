'use client'

import { useRouter } from 'next/navigation'
import { VERIFICATION_ENABLED } from '@/lib/flags'

export default function VerifyPage() {
  const router = useRouter()

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        boxSizing: 'border-box',
        padding: '0 24px 40px',
      }}
    >
      <div style={{ padding: '40px 0 0', textAlign: 'center' }}>
        <span
          style={{
            font: '600 15px var(--font-ui)',
            letterSpacing: '0.08em',
            color: 'var(--color-ink)',
          }}
        >
          ———
        </span>
      </div>

      {/* ID verification card */}
      <div
        style={{
          marginTop: '40px',
          maxWidth: '480px',
          margin: '40px auto 0',
          border: '1px solid var(--color-line)',
          borderRadius: '2px',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-line)',
            font: '500 11px var(--font-ui)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink)',
          }}
        >
          Verify once, sell forever
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink)',
            }}
          >
            1 · PHOTO ID
          </span>
          <StatusBadge status="pending" />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderTop: '1px solid var(--color-line)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink)',
            }}
          >
            2 · SELFIE MATCH
          </span>
          <StatusBadge status="pending" />
        </div>

        <div
          style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--color-line)',
            fontSize: '12px',
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
          }}
        >
          one-time check. no biometric storage. required to buy, sell, or comment — browsing
          works without it. it protects sellers as much as buyers: everyone you transact with
          is a real, accountable person.
        </div>
      </div>

      <div
        style={{
          marginTop: '24px',
          maxWidth: '480px',
          margin: '24px auto 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <button
          disabled={!VERIFICATION_ENABLED}
          title={!VERIFICATION_ENABLED ? 'coming in beta' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '44px',
            width: '100%',
            background: VERIFICATION_ENABLED ? 'var(--color-ink)' : 'var(--color-line)',
            color: VERIFICATION_ENABLED ? 'var(--color-bg)' : 'var(--color-ink-soft)',
            border: `1px solid ${VERIFICATION_ENABLED ? 'var(--color-ink)' : 'var(--color-line)'}`,
            borderRadius: '2px',
            font: '500 14px var(--font-ui)',
            letterSpacing: '-0.01em',
            cursor: VERIFICATION_ENABLED ? 'pointer' : 'not-allowed',
          }}
        >
          Verify now
          {!VERIFICATION_ENABLED && (
            <span
              style={{
                marginLeft: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-soft)',
              }}
            >
              · COMING IN BETA
            </span>
          )}
        </button>

        <button
          onClick={() => router.push('/onboarding/setup')}
          style={{
            font: '500 13px var(--font-ui)',
            color: 'var(--color-ink)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          skip for now — browse only
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'done' | 'pending' }) {
  const done = status === 'done'
  return (
    <span
      style={{
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        height: '20px',
        padding: '0 7px',
        border: `1px solid ${done ? 'var(--color-accent)' : 'var(--color-line)'}`,
        borderRadius: '2px',
        fontFamily: 'var(--font-mono)',
        fontWeight: done ? 700 : 400,
        fontSize: '9px',
        letterSpacing: '0.08em',
        color: done ? 'var(--color-accent)' : 'var(--color-ink-soft)',
        whiteSpace: 'nowrap',
      }}
    >
      {done ? 'DONE' : 'PENDING'}
    </span>
  )
}
