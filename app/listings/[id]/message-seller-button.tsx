'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'

import Icon from '@/app/components/icon'
import { useStudio } from '@/app/components/studio'

interface Props {
  listingId: string
  /** inline = text link; action = 44px icon square; secondary = bordered commerce twin */
  variant?: 'inline' | 'action' | 'secondary'
}

export default function MessageSellerButton({ listingId, variant = 'inline' }: Props) {
  const studio = useStudio()
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

  if (variant === 'action') {
    return (
      <button
        onClick={() => void handleClick()}
        disabled={loading}
        className="pdp-action-btn"
        aria-label={loading ? 'Opening conversation' : 'Message seller'}
        style={{ cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
      >
        <Icon name="messages" size={studio.iconSize} />
      </button>
    )
  }

  if (variant === 'secondary') {
    return (
      <button
        onClick={() => void handleClick()}
        disabled={loading}
        className="pdp-secondary-btn"
        style={{ cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? 'Opening…' : 'Message'}
      </button>
    )
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      className="listing-buy-secondary-link"
      style={{ cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
    >
      {loading ? 'Opening…' : 'Message seller'}
    </button>
  )
}
