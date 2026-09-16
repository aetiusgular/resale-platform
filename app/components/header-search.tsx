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

export default function HeaderSearch({ defaultValue = '', protoBase }: { defaultValue?: string; protoBase?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // The proto tour (/styleguide/proto) has its own fixture browse grid at `protoBase`;
  // searching there must stay inside the tour instead of jumping to live /browse.
  const demo = protoBase !== undefined
  const browseHref = protoBase ?? '/browse'
  const savedHref = `${protoBase ?? ''}/saved`
  const compact = useCompact()
  // Live: second row only on browse + saved. Proto: keep it everywhere so
  // cycling catalog / saved / messages / sell does not change header height.
  const mobileRow = demo || pathname === browseHref || pathname === savedHref ? 'show' : 'hide'
  // The header persists across navigations (app/layout.tsx), so the field mirrors the
  // URL: the active query on /browse, empty elsewhere. Never clobber a field being typed in.
  const urlValue = pathname === browseHref ? (searchParams.get('q') ?? '') : ''
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.value = urlValue
  }, [urlValue])

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
        if (!demo) trackEvent('search_performed', { query: q })
        const onBrowse = pathname === browseHref
        const p = new URLSearchParams(onBrowse ? searchParams.toString() : '')
        p.delete('offset')
        if (q) p.set('q', q)
        else p.delete('q')
        if (onBrowse && !demo) {
          const filters: Record<string, string> = {}
          for (const k of ['dept', 'cat', 'size', 'brand'] as const) {
            const v = p.get(k)
            if (v) filters[k] = v
          }
          trackSearch(q, filters)
        }
        const qs = p.toString()
        router.push(qs ? `${browseHref}?${qs}` : browseHref)
      }}
    >
      <SearchIcon />
      <input
        ref={ref}
        name="q"
        type="search"
        defaultValue={defaultValue || urlValue}
        placeholder={compact ? 'Search' : 'Search designers, items, sellers'}
        aria-label="Search"
        autoComplete="off"
        enterKeyHint="search"
      />
    </form>
  )
}
