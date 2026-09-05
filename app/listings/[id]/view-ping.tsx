'use client'

/**
 * Counts a listing view once per mount (POST /api/listings/[id]/view — rate
 * limited per IP server-side). Mounted for non-owner viewers only; fire-and-forget.
 */
import { useEffect } from 'react'

export default function ViewPing({ listingId }: { listingId: string }) {
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/listings/${listingId}/view`, { method: 'POST', keepalive: true, signal: ctrl.signal }).catch(() => {})
    return () => ctrl.abort()
  }, [listingId])
  return null
}
