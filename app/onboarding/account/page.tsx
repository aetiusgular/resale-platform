'use client'

/**
 * /onboarding/account — finishes an OAuth (Google / Apple) sign-up: the auth
 * user exists but has no profile yet. The username is derived from the email
 * (changeable 1× / 30 days in Settings) and the member lands in browse. A
 * signed-out visitor is sent to /enter, which is the signup form itself.
 */
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { AuthSplit } from '@/app/components/auth-frame'
import { createProfileForUser } from '@/app/enter/signup-form'
import StepRail from '../step-rail'

export default function AccountPage() {
  return (
    <AuthSplit>
      <Suspense>
        <FinishSetup />
      </Suspense>
    </AuthSplit>
  )
}

function FinishSetup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/browse'
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    // Promise chain: state updates only in resolved callbacks (never sync in the effect).
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (cancelled) return
        if (!user) { router.replace('/enter'); return }
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
        if (cancelled) return
        if (profile) { router.replace(next); router.refresh(); return }
        const created = await createProfileForUser(supabase, user.id, user.email ?? '')
        if (cancelled) return
        if (!created.ok) { setError(created.error.toUpperCase()); return }
        setUsername(created.username)
        window.setTimeout(() => { router.replace(next); router.refresh() }, 900)
      })
      .catch(() => { if (!cancelled) setError('COULD NOT FINISH SETUP — RELOAD TO TRY AGAIN') })
    return () => { cancelled = true }
  }, [router, next])

  return (
    <div>
      <StepRail current={1} />
      <div className="auth-form__head">
        <span className="modal__title">FINISHING SETUP</span>
        <span className="tag">FREE</span>
      </div>
      <h1 className="auth-form__title">{username ? `Welcome, @${username}.` : 'One moment.'}</h1>
      <p className="auth-form__sub">{username ? 'You can change your username once every 30 days in Settings.' : 'Creating your profile…'}</p>
      {error && (
        <div className="alert-line" role="alert">
          {error} — <Link href="/enter" style={{ textDecoration: 'underline' }}>BACK TO SIGN UP</Link>
        </div>
      )}
    </div>
  )
}
