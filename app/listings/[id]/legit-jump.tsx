'use client'

/**
 * "n legit" — the placard's jump to the legit check thread. A plain #lc-thread
 * anchor pushes a history entry, and the page's Back link is history-aware: the
 * first Back would only strip the hash. So the jump scrolls itself and writes the
 * hash with replaceState (the URL stays shareable, the history stays one entry).
 * Without JS it is still an ordinary in-page anchor.
 */
import type { MouseEvent } from 'react'
import { Check } from '@phosphor-icons/react/ssr'

export default function LegitJump({ count }: { count: number }) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const thread = document.getElementById('lc-thread')
    if (!thread) return
    e.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    thread.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    // Hand keyboard and screen-reader users the thread, as a native hash jump would.
    thread.focus({ preventScroll: true })
    window.history.replaceState(window.history.state, '', '#lc-thread')
  }

  return (
    <a className="pdp__legit" href="#lc-thread" title={`${count} legit. Jumps to the legit check thread.`} aria-label={`${count} legit checks. Jump to the legit check thread.`} data-testid="lc-chip" onClick={onClick}>
      <Check size={13} aria-hidden="true" />
      <span>{count}</span>
    </a>
  )
}
