'use client'

/**
 * Header search — the underline field with the "/" shortcut, plus search by image
 * (design page 21, boards S0–S4 / M0–M2):
 *
 *   S0 default      magnifier · input · scan glyph (44px hit area, tooltip)
 *   S1 focused      underline → ink; "PASTE IMAGE ⌘V" microlabel until the first keystroke
 *   S2 image mode   scan glyph in place of the magnifier, "Paste an image (⌘V) or drop it
 *                   here", CHOOSE FILE (the fallback) and ×; ESC / × return to text
 *   S3 drag-over    hover fill + ink underline, "Drop to search by image" (the whole page
 *                   accepts the drop; the cue lives in the field only)
 *   S4 pasted       thumbnail chip + SEARCHING… for the round trip, then /search/image
 *   R1 results      the field mirrors the query: chip + IMAGE · CATEGORY; typed text
 *                   re-runs the search with the image AND the words (close tier fused
 *                   in the engine); × clears and returns to browse
 *   M0 / M1         ≤720px the glyph opens the bottom sheet (camera / library / clipboard)
 *
 * Entry points: paste in the field, paste anywhere on browse / home / results when nothing
 * editable has focus, drop anywhere, the glyph, the picker. Text typed before the image is
 * kept and sent with it. The image is resized on the client (≤ 768 px JPEG), held in memory
 * for the request and never stored or put in a URL (lib/visual-search/store.ts).
 *
 * Text submit is unchanged: /browse?q=…, keeping the filter set when already on /browse.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ScanIcon, SearchIcon, XIcon } from './icons'
import { useCompact } from './use-compact'
import ImageSearchSheet from './image-search-sheet'
import { trackEvent } from '@/lib/analytics'
import { VISUAL_SEARCH_PUBLIC_ENABLED } from '@/lib/flags'
import { trackSearch } from '@/lib/recs/telemetry'
import {
  isEditableTarget, normalizeQueryText, pasteKeyLabel, pickImageFile, queryChipLabel, QUERY_IMAGE_TYPES,
} from '@/lib/visual-search/shared'
import {
  cancelVisualSearch, clearVisualSearch, requeryVisualSearch, searchWithImage, useVisualSearch,
} from '@/lib/visual-search/store'

export const VISUAL_RESULTS_PATH = '/search/image'
const noopSubscribe = () => () => {}
const PASTE_ANYWHERE_PATHS = new Set(['/', '/browse', VISUAL_RESULTS_PATH])

export default function HeaderSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const compact = useCompact()
  const visual = useVisualSearch()
  const visualOn = VISUAL_SEARCH_PUBLIC_ENABLED

  const onResults = pathname === VISUAL_RESULTS_PATH
  const searching = visual.status === 'searching'
  const showingQuery = onResults && visual.image !== null && !searching
  const [imageMode, setImageMode] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [focused, setFocused] = useState(false)
  const [typed, setTyped] = useState(Boolean(defaultValue))
  const [sheetOpen, setSheetOpen] = useState(false)
  // Hydration-safe: the server renders ⌘V, the client swaps in its platform's key.
  const pasteKey = useSyncExternalStore(noopSubscribe, () => pasteKeyLabel(navigator.platform), () => '⌘V')

  // ≤720px the row itself only belongs to browse, saved and the image results page (Mobile
  // Pages 1A / 1C, M0 / M2) — every other page keeps the single 52px header row.
  const mobileRow = pathname === '/browse' || pathname === '/saved' || onResults ? 'show' : 'hide'

  // The header persists across navigations (app/layout.tsx), so the field mirrors the URL:
  // the active query on /browse, the typed words of the image query on /search/image, empty
  // elsewhere. Never clobber a field being typed in.
  const urlValue = pathname === '/browse' ? (searchParams.get('q') ?? '') : onResults ? visual.query.text : ''
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) { el.value = urlValue; setTyped(Boolean(urlValue)) }
  }, [urlValue])

  // "/" focuses the field from anywhere that is not an editable element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target as Element | null)) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── search by image: one entry for every source ──────────────────────────────────────
  const fire = useCallback(async (file: Blob) => {
    if (!visualOn) return
    setSheetOpen(false)
    setImageMode(false)
    setDragOver(false)
    const text = normalizeQueryText(ref.current?.value)
    const ok = await searchWithImage(file, { text, category: null, autoCategory: true })
    if (ok && pathname !== VISUAL_RESULTS_PATH) router.push(VISUAL_RESULTS_PATH)
  }, [visualOn, pathname, router])

  // Paste anywhere on browse / home / results when nothing editable has focus (the field's
  // own onPaste covers the focused case; editable targets are skipped so nothing fires twice).
  useEffect(() => {
    if (!visualOn || !PASTE_ANYWHERE_PATHS.has(pathname)) return
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(document.activeElement)) return
      const file = pickImageFile(e.clipboardData)
      if (!file) return
      e.preventDefault()
      void fire(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [visualOn, pathname, fire])

  // Drop anywhere on any page with the header; the cue lives in the field (S3).
  useEffect(() => {
    if (!visualOn) return
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
    const onDragLeave = (e: DragEvent) => { if (e.relatedTarget === null) setDragOver(false) }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(false)
      const file = pickImageFile(e.dataTransfer)
      if (file) void fire(file)
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [visualOn, fire])

  // ESC leaves image mode / closes the sheet; focus stays in the field.
  useEffect(() => {
    if (!imageMode && !sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setImageMode(false)
      setSheetOpen(false)
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageMode, sheetOpen])

  const openImageEntry = () => {
    if (compact) { setSheetOpen(true); return }
    setImageMode(true)
    ref.current?.focus()
  }

  const leaveImageMode = () => {
    setImageMode(false)
    ref.current?.focus()
  }

  const clearQuery = () => {
    clearVisualSearch()
    setImageMode(false)
    if (ref.current) { ref.current.value = ''; setTyped(false) }
    if (onResults) router.push('/browse')
  }

  const submitText = () => {
    const q = (ref.current?.value ?? '').trim()
    trackEvent('search_performed', { query_length: q.length })
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
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searching) return
    if (showingQuery) {
      // text + image: the words re-run the search with the same image
      void requeryVisualSearch({ text: normalizeQueryText(ref.current?.value) })
      return
    }
    setImageMode(false)
    submitText()
  }

  const chip = queryChipLabel(visual.response?.category ?? visual.query.category)
  const inputPlaceholder = imageMode || (onResults && !visual.image)
    ? `Paste an image (${pasteKey}) or drop it here`
    : showingQuery
      ? 'Add words to narrow it'
      : compact ? 'Search' : 'Search designers, items, sellers'
  const inImageEntry = imageMode || (onResults && !visual.image && !searching)
  const glyphIsScan = inImageEntry || dragOver
  const cls = [
    'search',
    focused ? 'is-focused' : '',
    inImageEntry ? 'is-image' : '',
    dragOver ? 'is-dragover' : '',
    searching ? 'is-searching' : '',
    showingQuery ? 'has-query' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <form
        className={cls}
        role="search"
        data-mobile={mobileRow}
        data-testid="search-field"
        onSubmit={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}
      >
        {glyphIsScan ? <span className="search__glyph search__glyph--scan" aria-hidden="true"><ScanIcon /></span> : <SearchIcon />}

        {dragOver ? (
          <span className="search__drop" data-testid="search-drop-cue">Drop to search by image</span>
        ) : (
          <>
            {(searching || showingQuery) && visual.image && (
              <span className="search__chip" data-testid="search-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="search__thumb" src={visual.image.url} alt="" />
                {searching ? (
                  <span className="search__label search__label--searching">SEARCHING…</span>
                ) : (
                  <span className="search__label">
                    {chip.label}
                    {chip.suffix && <span className="search__label-sub"> {chip.suffix}</span>}
                  </span>
                )}
              </span>
            )}
            {/* Always mounted (focus stays in the field through S4); hidden while searching. */}
            <input
                ref={ref}
                name="q"
                type="search"
                className={searching ? 'search__input is-hidden' : 'search__input'}
                defaultValue={defaultValue || urlValue}
                placeholder={inputPlaceholder}
                aria-label={inImageEntry ? 'Search by image: paste, drop, or type words to send with it' : 'Search'}
                autoComplete="off"
                enterKeyHint="search"
                maxLength={showingQuery || inImageEntry ? 200 : undefined}
                onChange={(e) => setTyped(e.currentTarget.value.length > 0)}
                onPaste={(e) => {
                  if (!visualOn) return
                  const file = pickImageFile(e.clipboardData)
                  if (!file) return
                  e.preventDefault()
                  void fire(file)
                }}
              />
          </>
        )}

        {visualOn && !dragOver && (
          <>
            {focused && !typed && !inImageEntry && !searching && !showingQuery && (
              <span className="search__hint" aria-hidden="true">PASTE IMAGE {pasteKey}</span>
            )}
            {inImageEntry ? (
              <span className="search__tools">
                <button type="button" className="search__choose" onClick={() => fileRef.current?.click()} data-testid="search-choose-file">
                  CHOOSE FILE
                </button>
                <button
                  type="button"
                  className="search__clear"
                  aria-label={onResults ? 'Leave search by image' : 'Back to text search'}
                  onClick={() => (onResults ? clearQuery() : leaveImageMode())}
                  data-testid="search-clear"
                >
                  <XIcon size={12} strokeWidth={1.3} />
                </button>
              </span>
            ) : searching ? (
              <button type="button" className="search__clear" aria-label="Cancel search" onClick={() => cancelVisualSearch()} data-testid="search-clear">
                <XIcon size={12} strokeWidth={1.3} />
              </button>
            ) : showingQuery ? (
              <button type="button" className="search__clear" aria-label="Clear image search" onClick={clearQuery} data-testid="search-clear">
                <XIcon size={12} strokeWidth={1.3} />
              </button>
            ) : (
              <button
                type="button"
                className="search__scan"
                title="Search by image"
                aria-label="Search by image"
                onClick={openImageEntry}
                data-testid="search-scan-btn"
              >
                <ScanIcon />
              </button>
            )}
          </>
        )}

        {visualOn && (
          <input
            ref={fileRef}
            type="file"
            accept={QUERY_IMAGE_TYPES.join(',')}
            className="search__file"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="search-file-input"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (f) void fire(f)
            }}
          />
        )}
      </form>

      {visualOn && sheetOpen && (
        <ImageSearchSheet onClose={() => setSheetOpen(false)} onImage={(f) => void fire(f)} />
      )}
    </>
  )
}
