'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CodeRow {
  code: string
  status: 'unused' | 'claimed'
  used_by: string | null
  profiles?: { username: string } | { username: string }[] | null
}

function claimerUsername(row: CodeRow): string | null {
  if (!row.profiles) return null
  if (Array.isArray(row.profiles)) return row.profiles[0]?.username ?? null
  return row.profiles.username
}

export default function CodesClient({ codes }: { codes: CodeRow[] }) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        boxSizing: 'border-box',
        padding: '0 24px 40px',
      }}
    >
      <div style={{ padding: '48px 0 0', textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '24px',
            lineHeight: 1.35,
            color: 'var(--color-ink)',
          }}
        >
          Three keys. Choose carefully.
        </p>
        <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
          membership moves by referral — these are yours to give.
        </div>
      </div>

      <div
        style={{
          marginTop: '36px',
          maxWidth: '480px',
          margin: '36px auto 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {codes.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--color-ink-soft)', textAlign: 'center' }}>
            generating your codes…
          </div>
        )}

        {codes.map((row) => {
          const claimed = row.status === 'claimed'
          const claimer = claimerUsername(row)
          const isCopied = copied === row.code

          return (
            <div
              key={row.code}
              style={{
                border: `1px solid ${claimed ? 'var(--color-line)' : 'var(--color-ink)'}`,
                borderRadius: '2px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.04em',
                  color: claimed ? 'var(--color-ink-soft)' : 'var(--color-ink)',
                  textDecoration: claimed ? 'line-through' : 'none',
                }}
                data-testid="code-token"
              >
                {row.code}
              </span>

              <span
                style={{
                  marginLeft: 'auto',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink-soft)',
                }}
              >
                {claimed && claimer
                  ? `CLAIMED BY @${claimer.toUpperCase()}`
                  : 'UNUSED'}
              </span>

              {!claimed && (
                <button
                  onClick={() => handleCopy(row.code)}
                  style={{
                    flexShrink: 0,
                    font: '500 11px var(--font-ui)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isCopied ? 'var(--color-accent)' : 'var(--color-ink)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  data-testid="copy-button"
                >
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: '24px',
          fontSize: '12px',
          lineHeight: 1.6,
          color: 'var(--color-ink-soft)',
          textAlign: 'center',
          maxWidth: '480px',
          margin: '24px auto 0',
        }}
      >
        invites earn tier credit when your invitee completes a first sale.
      </div>

      <div
        style={{
          marginTop: '32px',
          maxWidth: '480px',
          margin: '32px auto 0',
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '44px',
            width: '100%',
            background: 'var(--color-bg)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-ink)',
            borderRadius: '2px',
            font: '500 14px var(--font-ui)',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
        >
          Enter the archive
        </button>
      </div>
    </div>
  )
}
