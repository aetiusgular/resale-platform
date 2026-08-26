'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthModal } from '@/app/components/auth-modal-provider'

interface Props {
  listingId: string
}

export default function MessageSellerButton({ listingId }: Props) {
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
      onClick={() => void handleClick()}
      disabled={loading}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid transparent', borderRadius: '2px', font: '500 14px var(--font-ui)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
    >
      {loading ? 'Opening…' : 'Message seller'}
    </button>
  )
}
