/**
 * Display formatters shared by server and client components. No 'use client'
 * here on purpose: a function exported from a client module becomes a client
 * reference and cannot be *called* during a server render (listings/[id]/page.tsx
 * formats "LISTED 3D AGO" on the server).
 */

const TITLE_MAX_CHARS = 38

/** Card titles: hard cap with an ellipsis so rows stay one line. */
export function truncateTitle(t: string): string {
  return t.length > TITLE_MAX_CHARS ? t.slice(0, TITLE_MAX_CHARS - 1).trimEnd() + '…' : t
}

/** Mono relative timestamp — JUST NOW · 14M AGO · 3H AGO · 2D AGO · 1W AGO · 2MO AGO. */
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'JUST NOW'
  if (mins < 60) return `${mins}M AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}H AGO`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}D AGO`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks}W AGO`
  return `${Math.floor(days / 30)}MO AGO`
}
