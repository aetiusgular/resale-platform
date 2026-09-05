'use client'

/**
 * Header search — underline field with the "/" keyboard shortcut. Submitting
 * navigates to /browse?q=…; when already on /browse the current filter set is
 * kept so a query refines the active view (pagination offset resets).
 */
import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SearchIcon } from './icons'
import { useCompact } from './use-compact'
import { trackEvent } from '@/lib/analytics'
import { trackSearch } from '@/lib/recs/telemetry'

export default function HeaderSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // ≤720px the placeholder collapses to "Search" (reference Header / useIsMobile), and the
  // row itself only belongs to browse + saved (Mobile Pages 1A / 1C) — every other page
  // keeps the single 52px header row.
  const compact = useCompact()
  const mobileRow = pathname === '/browse' || pathname === '/saved' ? 'show' : 'hide'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      className="search"
      role="search"
      data-mobile={mobileRow}
      onSubmit={(e) => {
        e.preventDefault()
        const q = (ref.current?.value ?? '').trim()
        trackEvent('search_performed', { query: q })
        const onBrowse = pathname === '/browse'
        const p = new URLSearchParams(onBrowse ? searchParams.toString() : '')
        p.delete('offset')
        if (q) p.set('q', q)
        else p.delete('q')
        if (onBrowse) {
          const filters: Record<string, string> = {}
          for (const k of ['dept', 'cat', 'size', 'brand'] as const) {
            const v = p.get(k)
            if (v) filters[k] = v
          }
          trackSearch(q, filters)
        }
        const qs = p.toString()
        router.push(qs ? `/browse?${qs}` : '/browse')
      }}
    >
      <SearchIcon />
      <input
        ref={ref}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={compact ? 'Search' : 'Search designers, items, sellers'}
        aria-label="Search"
        autoComplete="off"
        enterKeyHint="search"
      />
    </form>
  )
}
