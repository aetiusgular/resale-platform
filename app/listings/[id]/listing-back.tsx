'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@/app/components/icons'

/** History-aware back. Falls through to the listing's browse crumb if there's no stack. */
export default function ListingBack({ href }: { href: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      className="pdp__back"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(href)
      }}
    >
      <ArrowLeftIcon size={16} />
      Back
    </button>
  )
}
