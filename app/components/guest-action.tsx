'use client'

/**
 * GuestAction — a button styled to look like whatever authed control it stands in
 * for (a Buy link, a Message link, a header "Sign in"), but which opens the sign-in
 * popup instead of performing the action. Rendered only for signed-out visitors; the
 * authed branch renders the real Link/button.
 *
 * `next` is where OAuth returns after login (e.g. /checkout/<id> so the guest lands
 * mid-purchase). Email sign-in refreshes in place instead, so the guest is back on the
 * same page — now authed — and the real control is available.
 */
import { useAuthModal } from './auth-modal-provider'

export default function GuestAction({
  next,
  children,
  style,
  className,
  testId,
}: {
  next?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  testId?: string
}) {
  const { openAuthModal } = useAuthModal()
  return (
    <button
      type="button"
      onClick={() => openAuthModal(next)}
      className={className}
      data-testid={testId}
      style={{ cursor: 'pointer', ...style }}
    >
      {children}
    </button>
  )
}
