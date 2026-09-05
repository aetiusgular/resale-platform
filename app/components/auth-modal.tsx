'use client'

/**
 * AuthModal (design option 1R) — the sign-in / create-account popup that fronts
 * every guest-gated action (header SIGN IN, SELL, save, message, buy, offer).
 * Opened by useAuthModal().openAuthModal(next, gate?).
 *
 * SIGN IN tab: email + password (Supabase), then the Sign Up Pages 3A social block —
 * stacked CONTINUE WITH GOOGLE / APPLE rows with brand marks (split GOOGLE | APPLE pair
 * at ≤720px), always shown. Email sign-in keeps the guest in place:
 * on success we close and router.refresh() so the same page re-renders with the
 * session and the action they clicked becomes available. CREATE ACCOUNT is the
 * reference email + password form inline (password hint, username derived from the
 * email) with the same social block.
 *
 * `gate` dresses the popup for the action that opened it (mobile-web 25 · Auth Gate
 * Sheet): heading "SIGN IN TO SAVE", the listing strip under it, primary "SIGN IN & SAVE →",
 * SIGN IN tab first. Without it: "SIGN IN TO CONTINUE" ("SELLING NEEDS AN ACCOUNT" on the
 * sell gate), CREATE ACCOUNT tab first. `next` is where OAuth returns after login (the page
 * the guest was on). The full /enter and /enter/login routes still exist as a fallback.
 *
 * ≤720px the popup is a bottom sheet over the dimmed page (scrim/modal rules in
 * globals.css) with a CONTINUE BROWSING AS GUEST link under the form.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import SignupForm from '@/app/enter/signup-form'
import SocialAuthButtons from './social-auth-buttons'
import { HeartIcon, XIcon } from './icons'

export type AuthGate = {
  /** Context heading, e.g. "SIGN IN TO SAVE". */
  title?: string
  /** Primary button label on the SIGN IN tab, e.g. "SIGN IN & SAVE →". */
  cta?: string
  /** The listing the guest was about to save — shown as a strip above the tabs. */
  listing?: { brand: string; title: string; image?: string | null }
}

export default function AuthModal({ next, onClose, gate }: { next: string; onClose: () => void; gate?: AuthGate }) {
  const router = useRouter()
  const [tab, setTab] = useState<'signin' | 'create'>(gate?.listing ? 'signin' : 'create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (signInError) {
      setLoading(false)
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'WRONG EMAIL OR PASSWORD'
          : signInError.message === 'Email not confirmed'
            ? 'CHECK YOUR EMAIL TO CONFIRM YOUR ADDRESS BEFORE SIGNING IN'
            : signInError.message.toUpperCase(),
      )
      return
    }
    // Signed in — close and re-render the current page with the session so the
    // guarded action becomes available.
    onClose()
    router.refresh()
  }

  const create = tab === 'create'
  const heading = gate?.title ?? (next.startsWith('/sell') ? 'SELLING NEEDS AN ACCOUNT' : 'SIGN IN TO CONTINUE')
  const listing = gate?.listing

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Sign in or create account" onClick={onClose}>
      <div className="modal modal--auth" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">{heading}</span>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <XIcon size={11} strokeWidth={1.2} />
          </button>
        </div>
        {listing && (
          <div className="gate-strip" data-testid="auth-gate-listing">
            <span className="gate-strip__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {listing.image && <img src={listing.image} alt="" />}
            </span>
            <span className="gate-strip__main">
              <span className="gate-strip__brand">{listing.brand.toUpperCase()}</span>
              <span className="gate-strip__title">{listing.title}</span>
            </span>
            <span className="gate-strip__mark"><HeartIcon filled={false} size={13} /></span>
          </div>
        )}
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!create} className={`tab${!create ? ' is-active' : ''}`} onClick={() => setTab('signin')}>
            SIGN IN
          </button>
          <button type="button" role="tab" aria-selected={create} className={`tab${create ? ' is-active' : ''}`} onClick={() => setTab('create')}>
            CREATE ACCOUNT
          </button>
        </div>

        {!create ? (
          <form className="auth-modal__body" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="auth-modal-email">EMAIL</label>
            <input
              id="auth-modal-email"
              className="input-mono"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
            />
            <div className="field-label field-label--row" style={{ paddingTop: 14 }}>
              <label htmlFor="auth-modal-password">PASSWORD</label>
              <Link href="/enter/forgot" className="link-underline link-underline--sm" onClick={onClose}>FORGOT?</Link>
            </div>
            <input
              id="auth-modal-password"
              className="input-mono"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
            />
            {error && <div className="alert-line" role="alert">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading || !email || !password}>
              {loading ? 'SIGNING IN…' : (gate?.cta ?? 'SIGN IN →')}
            </button>
            <div className="or-rule"><span /><em>OR</em><span /></div>
            <SocialAuthButtons next={next} />
            <div className="legal-line">
              BY CONTINUING YOU AGREE TO THE <Link href="/terms" onClick={onClose}>TERMS</Link> &amp; <Link href="/privacy" onClick={onClose}>PRIVACY POLICY</Link>.
            </div>
          </form>
        ) : (
          <div className="auth-modal__body">
            <SignupForm next={next} compact onDone={onClose} />
          </div>
        )}
        <div className="auth-guest-link">
          <button type="button" className="link-underline" onClick={onClose}>CONTINUE BROWSING AS GUEST</button>
        </div>
      </div>
    </div>
  )
}
