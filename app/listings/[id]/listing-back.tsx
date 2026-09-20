'use client'

/**
 * History-aware back link for the listing page. With an in-app history entry
 * behind it, it steps back (the browse grid keeps its scroll and filters).
 * Landed here cold (shared link, search result, reload) → it follows its href,
 * the listing's own browse crumb, instead of bouncing the visitor off the site.
 *
 * It stays a real <a href>: crawlers, middle-click and no-JS all get the crumb.
 * No prefetch — most clicks end in history.back(), so a prefetched /browse
 * (rows + counts + facets) would usually be thrown away.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import { ArrowLeftIcon } from '@/app/components/icons'

const sansHash = (url: string) => url.split('#')[0]

/**
 * Is there a SAME-ORIGIN entry behind this one?
 * - Navigation API (Chromium, Safari 26.2+, Firefox 147+): its entry list is same-origin only, so
 *   canGoBack is exact.
 * - Otherwise: history.length also counts the site the visitor came from, so it is only trusted
 *   once this document has soft-navigated — i.e. the URL it was loaded on is not the URL it shows
 *   now. A cold landing or a reload therefore takes the href.
 */
function canStepBack(): boolean {
  if (typeof window === 'undefined') return false
  const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation
  if (nav && typeof nav.canGoBack === 'boolean') return nav.canGoBack
  const loadedOn = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.name
  const landedHere = !loadedOn || sansHash(loadedOn) === sansHash(window.location.href)
  return !landedHere && window.history.length > 1
}

export default function ListingBack({ href }: { href: string }) {
  const router = useRouter()

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // Modified clicks keep their browser meaning (new tab / window / download).
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!canStepBack()) return
    e.preventDefault()
    router.back()
  }

  return (
    <Link className="pdp__back" href={href} prefetch={false} onClick={onClick} data-testid="listing-back">
      <ArrowLeftIcon size={16} />
      Back
    </Link>
  )
}
