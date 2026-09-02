'use client'

import { useState } from 'react'
import Icon from '@/app/components/icon'
import { useStudio } from '@/app/components/studio'

interface Props {
  title: string
}

export default function ShareButton({ title }: Props) {
  const studio = useStudio()
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      className="pdp-action-btn"
      onClick={() => void handleShare()}
      aria-label={copied ? 'Link copied' : 'Share listing'}
    >
      <Icon name="share" size={studio.iconSize} label={copied ? 'Link copied' : 'Share listing'} />
    </button>
  )
}
