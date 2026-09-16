'use client'

/**
 * PhoneVerify — settings pane for the Branch 4 / L1 phone gate (design 2A "02 — PHONE").
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
  /** Hub layout: single row, no intro copy. */
  compact?: boolean
}

/** +15551234567 → +1 (555) ••• ••67 for display; anything else shown verbatim. */
function maskedPhone(e164: string | null): string {
  if (!e164) return ''
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `+1 (${m[1]}) ••• ••${m[3].slice(2)}` : e164
}

export default function PhoneVerify({ verified, initialPhone, compact = false }: Props) {
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

  if (verified) {
    return (
      <div className="phone-row">
        <span className="phone-num">{maskedPhone(initialPhone)}</span>
        <span className="tag tag--ink">VERIFIED</span>
        <span className="spacer" />
        {!compact && <span className="page-note">CHANGES GO THROUGH SUPPORT</span>}
      </div>
    )
  }

  if (step === 'phone') {
    return (
      <>
        {!compact && <p className="settings-note" style={{ paddingTop: 16 }}>A verified mobile number keeps the marketplace safe. VOIP and virtual numbers aren&rsquo;t accepted.</p>}
        <div className="phone-row" style={{ flexWrap: 'wrap' }}>
          <input
            className="input-mono"
            style={{ maxWidth: 260 }}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            aria-label="Mobile number"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && phone.trim()) sendCode() }}
          />
          <span className="tag">UNVERIFIED</span>
          <span className="spacer" />
          <button type="button" className="btn-primary btn-primary--inline" onClick={sendCode} disabled={busy || !phone.trim()}>
            {busy ? 'SENDING…' : 'VERIFY NUMBER'}
          </button>
        </div>
        {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
      </>
    )
  }

  const digits = code.replace(/\D/g, '').slice(0, 6)
  return (
    <>
      <div className="phone-sent">CODE SENT TO {maskedPhone(normalizeForDisplay(phone))}</div>
      <div className="phone-row" style={{ flexWrap: 'wrap' }}>
        <label className="code-boxes" aria-label="Verification code">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`code-box${digits[i] ? ' is-filled' : ''}`}>{digits[i] ?? ''}</span>
          ))}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) confirmCode() }}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            autoFocus
            aria-label="Enter the 6-digit code"
          />
        </label>
        <button type="button" className="btn-primary btn-primary--inline" onClick={confirmCode} disabled={busy || !code.trim()}>
          {busy ? 'VERIFYING…' : 'CONFIRM'}
        </button>
        <button type="button" className="link-underline" onClick={sendCode} disabled={busy}>RESEND</button>
        <button type="button" className="link-underline" onClick={() => { setStep('phone'); setCode(''); setError(null) }} disabled={busy}>CHANGE NUMBER</button>
      </div>
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
    </>
  )
}

/** Best-effort local normalization of what the user typed (server normalizes authoritatively). */
function normalizeForDisplay(input: string): string {
  const digits = input.replace(/[^\d]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return input
}
