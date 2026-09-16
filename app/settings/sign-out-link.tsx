'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { useProtoBase } from '@/app/components/proto-base'

/** Underlined SIGN OUT → clears the Supabase session and lands on /enter. */
export default function SignOutLink({ className = 'link-underline', label = 'SIGN OUT →' }: { className?: string; label?: string }) {
  const router = useRouter()
  const demo = useProtoBase() !== ''
  const [busy, setBusy] = useState(false)
  async function signOut() {
    // The proto tour has no session to end; the control stays visible but inert.
    if (demo) return
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/enter')
    router.refresh()
  }
  return (
    <button type="button" className={className} onClick={signOut} disabled={busy} data-testid="settings-signout">
      {busy ? 'SIGNING OUT…' : label}
    </button>
  )
}
