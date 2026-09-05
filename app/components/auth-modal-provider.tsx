'use client'

/**
 * AuthModalProvider — mounts once in the root layout and exposes the sign-in popup to
 * the whole app via useAuthModal(). Two entry points:
 *   - openAuthModal(next?, gate?) → show the popup (header "Sign in").
 *   - requireAuth(next?, gate?)   → for guarded write actions: resolves true if a session
 *                                   exists (proceed), otherwise opens the popup and resolves
 *                                   false (caller aborts). Checks the live session each call,
 *                                   so it's correct regardless of when the click happens.
 *
 * `gate` dresses the popup for the action that opened it (mobile-web 25 · Auth Gate Sheet):
 * a heading ("SIGN IN TO SAVE"), the primary button label ("SIGN IN & SAVE →") and the
 * listing the guest was about to save, shown as a strip above the tabs. Without it the
 * popup is the plain "SIGN IN TO CONTINUE" one.
 *
 * This is UX gating only. The real security boundary is unchanged: every write API still
 * requires a server session (401) and RLS still denies anon writes. A guest could never
 * actually save/buy/message even if this check were bypassed.
 */
import { createContext, useCallback, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import AuthModal, { type AuthGate } from './auth-modal'

export type { AuthGate }

type Ctx = {
  openAuthModal: (next?: string, gate?: AuthGate) => void
  closeAuthModal: () => void
  /** true → already signed in (proceed); false → popup opened, caller should abort. */
  requireAuth: (next?: string, gate?: AuthGate) => Promise<boolean>
}

const AuthModalContext = createContext<Ctx | null>(null)

export function useAuthModal(): Ctx {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}

export default function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [next, setNext] = useState('/browse')
  const [gate, setGate] = useState<AuthGate | undefined>(undefined)

  const openAuthModal = useCallback((n?: string, g?: AuthGate) => {
    setNext(n ?? pathname ?? '/browse')
    setGate(g)
    setOpen(true)
  }, [pathname])

  const closeAuthModal = useCallback(() => setOpen(false), [])

  const requireAuth = useCallback(async (n?: string, g?: AuthGate): Promise<boolean> => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (data.session) return true
    setNext(n ?? pathname ?? '/browse')
    setGate(g)
    setOpen(true)
    return false
  }, [pathname])

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal, requireAuth }}>
      {children}
      {open && <AuthModal next={next} onClose={closeAuthModal} gate={gate} />}
    </AuthModalContext.Provider>
  )
}
