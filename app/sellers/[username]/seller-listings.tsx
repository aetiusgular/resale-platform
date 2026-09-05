'use client'

/**
 * Seller profile listing grid — the shared ListingCard with save toggles
 * (guests get the sign-in popup).
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import ListingCard, { type ListingCardData } from '@/app/components/listing-card'
import { useAuthModal } from '@/app/components/auth-modal-provider'
import { trackEvent } from '@/lib/analytics'

export default function SellerListingsGrid({ listings, isGuest, own }: { listings: ListingCardData[]; isGuest: boolean; own: boolean }) {
  const { openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  async function toggle(id: string, saved: boolean) {
    if (isGuest) { openAuthModal(pathname); return }
    setSavedIds((prev) => { const n = new Set(prev); if (saved) n.delete(id); else n.add(id); return n })
    const res = await fetch('/api/saves', {
      method: saved ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: id }),
    })
    if (!res.ok) {
      setSavedIds((prev) => { const n = new Set(prev); if (saved) n.add(id); else n.delete(id); return n })
    } else if (!saved) {
      trackEvent('listing_saved', { listing_id: id })
    }
  }

  return (
    <div className="grid" data-testid="seller-listings-grid">
      {listings.map((l, i) => (
        <ListingCard key={l.id} listing={l} isSaved={savedIds.has(l.id)} onSaveToggle={toggle} position={i} own={own} />
      ))}
    </div>
  )
}
