'use client'

/**
 * Follow / unfollow a seller (G9, behind FOLLOWS_ENABLED — the server only mounts
 * this when the flag is on). POST/DELETE /api/follows; idempotent server-side.
 * Guests get the sign-in popup instead of a 401.
 */
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'

export default function FollowButton({
  sellerId,
  initialFollowing,
  small = false,
  guest = false,
}: {
  sellerId: string
  initialFollowing: boolean
  /** Compact variant for the listing page seller row (btn-follow--sm). */
  small?: boolean
  /** Signed-out viewer: clicking opens the sign-in popup. */
  guest?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { openAuthModal } = useAuthModal()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (guest) { openAuthModal(pathname); return }
    setLoading(true)
    const res = await fetch('/api/follows', {
      method: following ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: sellerId }),
    })
    setLoading(false)
    if (res.ok) {
      setFollowing((f) => !f)
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      className={`btn-follow${small ? ' btn-follow--sm' : ''}${following ? ' is-on' : ''}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={following}
      data-testid="follow-btn"
    >
      {loading ? '…' : following ? 'FOLLOWING' : 'FOLLOW'}
    </button>
  )
}
