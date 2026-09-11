'use client'

/**
 * PrefetchLink — next/link with optimistic full-route preloading.
 *
 * Default <Link> behavior on our all-dynamic routes only prefetches down to the
 * loading.tsx boundary when the link enters the viewport (skeleton shell, no
 * data). This wrapper upgrades to prefetch={true} — full route INCLUDING the
 * server-rendered data — the moment the user signals intent (hover, touch,
 * focus), so the subsequent click is usually served from the router cache.
 *
 * Pairs with experimental.staleTimes in next.config.ts: full-prefetch entries
 * are reusable for the `static` window, visited pages for the `dynamic` window.
 * Prefetching is production-only (Next disables it in dev).
 *
 * Navbar targets (header links, wordmark, account popout) pass `prefetch` so the
 * full prefetch runs as soon as they render; intent still re-runs it once the
 * cached entry has expired.
 */
import Link from 'next/link'
import { useState, useCallback, type ComponentProps, type MouseEvent, type TouchEvent, type FocusEvent } from 'react'

type Props = ComponentProps<typeof Link>

export default function PrefetchLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...rest }: Props) {
  const [intent, setIntent] = useState(false)

  const handleMouseEnter = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    setIntent(true)
    onMouseEnter?.(e)
  }, [onMouseEnter])

  const handleTouchStart = useCallback((e: TouchEvent<HTMLAnchorElement>) => {
    setIntent(true)
    onTouchStart?.(e)
  }, [onTouchStart])

  const handleFocus = useCallback((e: FocusEvent<HTMLAnchorElement>) => {
    setIntent(true)
    onFocus?.(e)
  }, [onFocus])

  return (
    <Link
      {...rest}
      // Before intent: caller's setting (default = viewport prefetch to the
      // loading boundary). After intent: full route + data.
      prefetch={intent ? true : prefetch}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onFocus={handleFocus}
    />
  )
}
