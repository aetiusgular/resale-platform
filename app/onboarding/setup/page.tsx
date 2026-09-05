'use client'

/**
 * /onboarding/setup — quick preferences (step 02 of ACCOUNT → PREFERENCES → VERIFY,
 * mobile-web 23): sizes (saved to profiles.sizes so the MY SIZES filter works from the
 * first browse), optional taste picks for the recs cold-start, and a shipping note.
 * CONTINUE and SKIP both go on to /onboarding/verify.
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { AuthPage } from '@/app/components/auth-frame'
import { SETTINGS_SIZE_GROUPS, SIZE_DEPTS, sizeKey, type SizeDept, type UserSizes } from '@/lib/sizes'
import StepRail from '../step-rail'

const NEXT_STEP = '/onboarding/verify'

export default function SetupPage() {
  const router = useRouter()
  const [sizes, setSizes] = useState<UserSizes>({})
  const [dept, setDept] = useState<SizeDept>('menswear')
  const [handle, setHandle] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cold-start taste picker (recs). Empty until/unless the engine returns options.
  const [aesthetics, setAesthetics] = useState<{ key: string; display_name: string }[]>([])
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([])

  const toggleSize = (cat: string, size: string) =>
    setSizes((prev) => {
      const cur = prev[cat] ?? []
      return { ...prev, [cat]: cur.includes(size) ? cur.filter((s) => s !== size) : [...cur, size] }
    })

  // The bar shows the member's handle (mobile-web 23); fail-soft when signed out.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!user || cancelled) return
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
        if (!cancelled && data?.username) setHandle(`@${String(data.username).toUpperCase()}`)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch the engine's aesthetic options once. Fail-soft: on off/unreachable the
  // proxy returns { aesthetics: [] } and the picker renders nothing.
  useEffect(() => {
    let cancelled = false
    fetch('/api/recs/aesthetics', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { aesthetics: [] }))
      .then((d: { aesthetics?: { key: string; display_name: string }[] }) => {
        if (!cancelled && Array.isArray(d.aesthetics)) setAesthetics(d.aesthetics.slice(0, 16))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const toggleAesthetic = (key: string) =>
    setSelectedAesthetics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const sizeCount = Object.values(sizes).reduce((n, g) => n + g.length, 0)

  async function handleContinue() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ quick_setup: { sizes, address: address.trim() || null } })
        .eq('id', user.id)
      if (updateError) {
        setLoading(false)
        setError(updateError.message)
        return
      }
      if (sizeCount > 0) {
        // Same contract as Settings → My sizes; powers the browse MY SIZES filter.
        await fetch('/api/settings/sizes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sizes }),
        }).catch(() => {})
      }
    }

    setLoading(false)
    // Cold-start: seed the picked aesthetics (fire-and-forget, fail-soft — never blocks onboarding).
    if (selectedAesthetics.length > 0) {
      void fetch('/api/recs/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aesthetics: selectedAesthetics }),
        keepalive: true,
      }).catch(() => {})
    }
    router.push(NEXT_STEP)
  }

  return (
    <AuthPage onboarding cta={handle ? { href: '/browse', label: handle } : { href: '/browse', label: 'SKIP — GO TO BROWSE →' }}>
      <StepRail current={2} />
      <div className="modal__title" style={{ paddingBottom: 10, display: 'block' }}>QUICK PREFERENCES</div>
      <h1 className="auth-form__title">Seed your feed.</h1>
      <p className="auth-form__sub">Your sizes power the MY SIZES filter and size alerts — never shown publicly. Everything here can change later in Settings.</p>

      <div className="sec-head" style={{ marginTop: 8 }}><span className="sec-head__label">1 — MY SIZES</span><span className="page-note">{sizeCount} SELECTED</span></div>
      <div className="tabs-line tabs-line--tight" role="tablist" style={{ marginTop: 12 }}>
        {SIZE_DEPTS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dept === d} className={`tab-mono${dept === d ? ' is-active' : ''}`} onClick={() => setDept(d)}>{d.toUpperCase()}</button>
        ))}
      </div>
      {SETTINGS_SIZE_GROUPS[dept].map((g) => {
        const key = sizeKey(dept, g.id)
        return (
          <div key={key}>
            <div className="chip-grid__label">{g.label}</div>
            <div className="chip-grid" style={{ '--cols': g.cols } as React.CSSProperties}>
              {g.scale.map((s) => {
                const on = (sizes[key] ?? []).includes(s)
                return (
                  <button key={s} type="button" className={`size-cell${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleSize(key, s)}>{s}</button>
                )
              })}
            </div>
          </div>
        )
      })}

      {aesthetics.length > 0 && (
        <>
          <div className="sec-head"><span className="sec-head__label">2 — WHAT YOU COLLECT</span><span className="page-note">OPTIONAL · TUNES YOUR FEED</span></div>
          <div className="option-grid">
            {aesthetics.map((a) => {
              const on = selectedAesthetics.includes(a.key)
              return (
                <button key={a.key} type="button" className={`option-cell${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggleAesthetic(a.key)}>
                  <span className="option-cell__t">{a.display_name}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="sec-head"><span className="sec-head__label">{aesthetics.length > 0 ? '3' : '2'} — SHIPPING</span><span className="page-note">OPTIONAL · PRE-FILLS CHECKOUT</span></div>
      <div className="field-block">
        <label className="field-label" htmlFor="setup-address">CITY OR FULL ADDRESS</label>
        <input id="setup-address" className="input-sans" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Add later in Settings if you prefer" autoComplete="street-address" />
      </div>

      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
      <div className="onb-cta">
        <button type="button" className="btn-primary" onClick={handleContinue} disabled={loading} data-testid="setup-continue">
          {loading ? 'SAVING…' : 'CONTINUE →'}
        </button>
        <button type="button" className="link-underline onb-cta__skip" onClick={() => router.push(NEXT_STEP)} data-testid="setup-skip">SKIP</button>
      </div>
    </AuthPage>
  )
}
