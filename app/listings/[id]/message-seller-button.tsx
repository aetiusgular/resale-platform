'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { ChatIcon } from '@/app/components/icons'

interface Props {
  listingId: string
  /** Button styling — the placard's icon + text link by default; the mobile seller row passes a link style. */
  className?: string
  label?: string
  testId?: string
  icon?: boolean
  iconSize?: number
}

export default function MessageSellerButton({ listingId, className = 'pdp__msg', label = 'Message seller', testId = 'message-seller-btn', icon = true, iconSize = 20 }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { openAuthModal } = useAuthModal()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    })
    if (res.ok) {
      const { conversation } = await res.json()
      router.push(`/messages/${conversation.id}`)
    } else if (res.status === 401) {
      // Session expired mid-session → sign-in popup rather than the full /enter page.
      setLoading(false)
      openAuthModal(pathname)
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleClick()}
      disabled={loading}
      data-testid={testId}
    >
      {loading ? 'OPENING…' : (<>{icon && <ChatIcon size={iconSize} />}{label}</>)}
    </button>
  )
}
