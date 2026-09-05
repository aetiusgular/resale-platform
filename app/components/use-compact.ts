'use client'

/**
 * `useCompact()` — true at ≤720px (the reference `useIsMobile` breakpoint). Backed by
 * matchMedia through useSyncExternalStore so it is hydration-safe (server + first client
 * render report false, then the real value applies).
 */
import { useSyncExternalStore } from 'react'

export const COMPACT_MQ = '(max-width: 720px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(COMPACT_MQ)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getSnapshot = () => window.matchMedia(COMPACT_MQ).matches
const getServerSnapshot = () => false

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
