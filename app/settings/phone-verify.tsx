'use client'

/**
 * PhoneVerify — settings pane for the Branch 4 / L1 phone gate.
 * Two-step: enter phone → receive SMS code → confirm. Talks to
 * POST /api/phone/start and POST /api/phone/verify. When the profile already
 * carries a verified number it renders the confirmed state instead. Rendered
 * only when PHONE_VERIFICATION_ENABLED is on (parent decides).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  verified: boolean
  initialPhone: string | null
}

const INK = 'var(--color-ink)'
const SOFT = 'var(--color-ink-soft)'
const LINE = 'var(--color-line)'
const BG = 'var(--color-bg)'

/** +15551234567 → (555) 123-4567 for display; anything else shown verbatim. */
function prettyPhone(e164: string | null): string {
  if (!e164) return ''
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

export default function PhoneVerify({ verified, initialPhone }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/phone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error ?? 'Could not send a code.'); return }
      setStep('code')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCode() {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error ?? 'That code isn’t right.'); return }
      router.refresh()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: INK }}>Phone</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: SOFT, lineHeight: 1.5, maxWidth: 480 }}>
        A verified mobile number helps keep the marketplace safe. VOIP and virtual numbers aren’t accepted.
      </p>

      {verified ? (
        <div style={{
          marginTop: 24, maxWidth: 480,
          border: `1px solid ${LINE}`, borderRadius: 2, padding: '16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: 'var(--color-accent)', fontSize: 14, flex: 'none' }}>&#10003;</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.08em', color: INK,
          }}>VERIFIED</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: INK }}>{prettyPhone(initialPhone)}</span>
        </div>
      ) : step === 'phone' ? (
        <div style={{ marginTop: 24, maxWidth: 480 }}>
          <label style={{
            display: 'block', font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: SOFT, marginBottom: 8,
          }}>Mobile number</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && phone.trim()) sendCode() }}
            style={{
              width: '100%', height: 44, padding: '0 12px',
              border: `1px solid ${LINE}`, borderRadius: 2, background: BG,
              font: '400 15px var(--font-ui)', color: INK, boxSizing: 'border-box',
            }}
          />
          {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-danger, #c0392b)' }}>{error}</div>}
          <button
            onClick={sendCode}
            disabled={busy || !phone.trim()}
            style={{
              marginTop: 16, height: 44, padding: '0 32px',
              background: INK, color: BG, border: `1px solid ${INK}`, borderRadius: 2,
              font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
              opacity: busy || !phone.trim() ? 0.35 : 1,
              cursor: busy || !phone.trim() ? 'not-allowed' : 'pointer',
            }}
          >{busy ? 'Sending…' : 'Send code'}</button>
        </div>
      ) : (
        <div style={{ marginTop: 24, maxWidth: 480 }}>
          <div style={{ fontSize: 13, color: SOFT, marginBottom: 12 }}>
            Enter the 6-digit code we texted to <span style={{ color: INK }}>{prettyPhone(normalizeForDisplay(phone))}</span>.
          </div>
          <label style={{
            display: 'block', font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: SOFT, marginBottom: 8,
          }}>Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="123456"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) confirmCode() }}
            style={{
              width: '100%', height: 44, padding: '0 12px',
              border: `1px solid ${LINE}`, borderRadius: 2, background: BG,
              font: '400 18px var(--font-mono)', letterSpacing: '0.2em', color: INK, boxSizing: 'border-box',
            }}
          />
          {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-danger, #c0392b)' }}>{error}</div>}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={confirmCode}
              disabled={busy || !code.trim()}
              style={{
                height: 44, padding: '0 32px',
                background: INK, color: BG, border: `1px solid ${INK}`, borderRadius: 2,
                font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
                opacity: busy || !code.trim() ? 0.35 : 1,
                cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
              }}
            >{busy ? 'Verifying…' : 'Verify'}</button>
            <button
              onClick={() => { setStep('phone'); setCode(''); setError(null) }}
              disabled={busy}
              style={{
                height: 44, padding: 0, background: 'none', border: 'none',
                font: '500 13px var(--font-ui)', color: SOFT, cursor: 'pointer',
              }}
            >Change number</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Best-effort local pretty-print of what the user typed (server normalizes authoritatively). */
function normalizeForDisplay(input: string): string {
  const digits = input.replace(/[^\d]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return input
}
