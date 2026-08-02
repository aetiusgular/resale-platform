'use client'

/**
 * Follow / unfollow a seller (G9, behind FOLLOWS_ENABLED — the server only mounts
 * this when the flag is on). POST/DELETE /api/follows; idempotent server-side.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FollowButton({
  sellerId,
  initialFollowing,
}: {
  sellerId: string
  initialFollowing: boolean
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
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
      onClick={toggle}
      disabled={loading}
      aria-pressed={following}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        height: 44, padding: '0 24px', borderRadius: 2, cursor: loading ? 'wait' : 'pointer',
        background: following ? 'var(--color-bg)' : 'var(--color-ink)',
        color: following ? 'var(--color-ink)' : 'var(--color-bg)',
        border: '1px solid var(--color-ink)', font: '500 14px var(--font-ui)', opacity: loading ? 0.6 : 1,
      }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
