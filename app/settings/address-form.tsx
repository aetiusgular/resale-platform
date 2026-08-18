'use client'

import { useState } from 'react'

export interface AddressValue {
  name?: string | null
  street1?: string | null
  street2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

const inputStyle: React.CSSProperties = {
  height: 44, border: '1px solid var(--color-line)', borderRadius: 2, padding: '0 12px',
  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-ink)',
  background: 'var(--color-bg)', outline: 'none', boxSizing: 'border-box', width: '100%',
}

/** Controlled address form that saves to /api/settings/address for the given kind. */
export default function AddressForm({
  kind, label, hint, initial,
}: {
  kind: 'shipping' | 'ship_from'
  label: string
  hint?: string
  initial?: AddressValue | null
}) {
  const [name, setName]       = useState(initial?.name ?? '')
  const [street1, setStreet1] = useState(initial?.street1 ?? '')
  const [street2, setStreet2] = useState(initial?.street2 ?? '')
  const [city, setCity]       = useState(initial?.city ?? '')
  const [stateV, setStateV]   = useState(initial?.state ?? '')
  const [zip, setZip]         = useState(initial?.zip ?? '')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/settings/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, address: { name, street1, street2, city, state: stateV, zip } }),
      })
      const data = await res.json()
      setMsg(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: data.error ?? 'Could not save.' })
    } catch {
      setMsg({ ok: false, text: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <div style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{hint}</div>}
      <input value={name}    onChange={e => setName(e.target.value)}    placeholder="Full name"     style={inputStyle} required />
      <input value={street1} onChange={e => setStreet1(e.target.value)} placeholder="Street address" style={inputStyle} required />
      <input value={street2} onChange={e => setStreet2(e.target.value)} placeholder="Apt / unit (optional)" style={inputStyle} />
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={city}   onChange={e => setCity(e.target.value)}   placeholder="City"  style={{ ...inputStyle, flex: 2 }} required />
        <input value={stateV} onChange={e => setStateV(e.target.value)} placeholder="State" style={{ ...inputStyle, flex: 1 }} required maxLength={2} />
        <input value={zip}    onChange={e => setZip(e.target.value)}    placeholder="ZIP"   style={{ ...inputStyle, flex: 1 }} required />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={saving} style={{ height: 44, padding: '0 24px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save address'}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? 'var(--color-ink-soft)' : 'var(--color-alert)' }}>{msg.text}</span>}
      </div>
    </form>
  )
}
