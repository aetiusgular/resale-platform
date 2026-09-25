'use client'

/**
 * Header search — the underline field with the "/" shortcut, plus search by image.
 *
 * Founder decision 2026-09-25 (supersedes page-21 boards S1 and S2): no "image mode" and
 * no focus hint. The scan glyph opens the file picker directly; on hover it says how else
 * to add an image (⌘K pastes one from the clipboard, ⌘V in the field works too, so does
 * dropping a file anywhere). Attaching an image only STAGES it, as a thumbnail chip in the
 * field: the user adds words if they want, and Enter runs ONE search with the image and the
 * words together (image-only refinement followed by a text refinement would be two engine
 * queries). States:
 *
 *   S0 default      magnifier · input · scan glyph (44px hit area, hover tooltip)
 *   S3 drag-over    hover fill + ink underline, "Drop to add the image" (the whole page
 *                   accepts the drop; the cue lives in the field only)
 *   staged          magnifier · thumb chip · input "Add words to narrow it" · ×
 *   S4 searching    thumb chip + SEARCHING… (× cancels), then /search/image
 *   R1 results      thumb chip · CATEGORY · the words; Enter re-runs the same image with
 *                   new words; × clears and returns to browse
 *   M0 / M1         ≤720px the glyph opens the bottom sheet (camera / library / clipboard),
 *                   which stages the photo the same way (the keyboard's Search key submits)
 *
 * The image is resized on the client (≤ 768 px JPEG), held in memory and never stored or put
 * in a URL (lib/visual-search/store.ts). Text-only submit is unchanged: /browse?q=…, keeping
 * the filter set when already on /browse.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ScanIcon, SearchIcon, XIcon } from './icons'
import { useCompact } from './use-compact'
import ImageSearchSheet from './image-search-sheet'
import { trackEvent } from '@/lib/analytics'
import { VISUAL_SEARCH_PUBLIC_ENABLED } from '@/lib/flags'
import { trackSearch } from '@/lib/recs/telemetry'
import { readClipboardImage } from '@/lib/visual-search/clipboard'
import {
  isEditableTarget, normalizeQueryText, pasteKeyLabel, pickImageFile, QUERY_IMAGE_TYPES,
} from '@/lib/visual-search/shared'
import {
  cancelVisualSearch, clearVisualSearch, runVisualSearch, stageVisualImage, useVisualSearch,
} from '@/lib/visual-search/store'

export const VISUAL_RESULTS_PATH = '/search/image'
const noopSubscribe = () => () => {}
const PASTE_ANYWHERE_PATHS = new Set(['/', '/browse', VISUAL_RESULTS_PATH])
const NOTE_MS = 2600

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
  const hasImage = visual.image !== null
  const staged = visual.status === 'staged' && hasImage
  // A finished (or failed) query is mirrored in the field only on its own page.
  const showingQuery = onResults && hasImage && (visual.status === 'ready' || visual.status === 'error')
  const chipShown = hasImage && (staged || searching || showingQuery)
  const [dragOver, setDragOver] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // Hydration-safe: the server renders the Mac keys, the client swaps in its platform's.
  const isMac = useSyncExternalStore(noopSubscribe, () => pasteKeyLabel(navigator.platform) === '⌘V', () => true)
  const modKey = isMac ? '⌘' : 'CTRL+'

  // ≤720px the row itself only belongs to browse, saved and the image results page (Mobile
  // Pages 1A / 1C, M0 / M2) — every other page keeps the single 52px header row.
  const mobileRow = pathname === '/browse' || pathname === '/saved' || onResults ? 'show' : 'hide'

  // The header persists across navigations (app/layout.tsx), so the field mirrors the URL:
  // the active query on /browse, the words of the image query on /search/image, empty
  // elsewhere. Never clobber a field being typed in, and never wipe words typed next to a
  // staged image.
  const urlValue = pathname === '/browse' ? (searchParams.get('q') ?? '') : onResults ? visual.query.text : ''
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && !staged) el.value = urlValue
  }, [urlValue, staged])

  // A newly staged image focuses the input so the words can follow at once.
  useEffect(() => {
    if (visual.stagedSeq > 0) ref.current?.focus()
  }, [visual.stagedSeq])

  // Transient microlabel at the right of the field (clipboard empty, wrong file type).
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), NOTE_MS)
    return () => clearTimeout(t)
  }, [note])

  // "/" focuses the field; ⌘K / Ctrl+K pastes an image from the clipboard.
  const stage = useCallback(async (file: Blob) => {
    if (!visualOn) return
    setSheetOpen(false)
    setDragOver(false)
    const ok = await stageVisualImage(file)
    if (!ok) setNote('JPEG, PNG OR WEBP ONLY')
  }, [visualOn])

  const pasteFromClipboard = useCallback(async () => {
    const blob = await readClipboardImage()
    if (blob) { void stage(blob); return }
    setNote('NO IMAGE ON THE CLIPBOARD')
    ref.current?.focus()
  }, [stage])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditableTarget(e.target as Element | null)) return
        e.preventDefault()
        ref.current?.focus()
        return
      }
      if (visualOn && (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        void pasteFromClipboard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visualOn, pasteFromClipboard])

  // Paste anywhere on browse / home / results when nothing editable has focus (the field's
  // own onPaste covers the focused case; editable targets are skipped so nothing fires twice).
  useEffect(() => {
    if (!visualOn || !PASTE_ANYWHERE_PATHS.has(pathname)) return
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(document.activeElement)) return
      const file = pickImageFile(e.clipboardData)
      if (!file) return
      e.preventDefault()
      void stage(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [visualOn, pathname, stage])

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
      if (file) void stage(file)
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [visualOn, stage])

  // ESC closes the sheet; focus returns to the field.
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSheetOpen(false)
      ref.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const openImageEntry = () => {
    if (compact) { setSheetOpen(true); return }
    fileRef.current?.click()
  }

  const clearQuery = () => {
    clearVisualSearch()
    if (ref.current) ref.current.value = ''
    if (onResults) router.push('/browse')
    else ref.current?.focus()
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
    if (staged || showingQuery) {
      // image (+ words) in ONE request; on the results page the same image re-runs with new words
      const text = normalizeQueryText(ref.current?.value)
      void runVisualSearch({ text }).then((ok) => {
        if (ok && pathname !== VISUAL_RESULTS_PATH) router.push(VISUAL_RESULTS_PATH)
      })
      return
    }
    submitText()
  }

  // The chip is the thumbnail alone while staged; on the results page the category joins it.
  const chipCategory = showingQuery ? (visual.response?.category ?? visual.query.category) : null
  const inputPlaceholder = staged || showingQuery
    ? 'Add words to narrow it'
    : compact ? 'Search' : 'Search designers, items, sellers'
  const cls = [
    'search',
    dragOver ? 'is-dragover' : '',
    searching ? 'is-searching' : '',
    chipShown ? 'has-query' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <form className={cls} role="search" data-mobile={mobileRow} data-testid="search-field" onSubmit={onSubmit}>
        {dragOver ? <span className="search__glyph search__glyph--scan" aria-hidden="true"><ScanIcon /></span> : <SearchIcon />}

        {dragOver ? (
          <span className="search__drop" data-testid="search-drop-cue">Drop to add the image</span>
        ) : (
          <>
            {chipShown && visual.image && (
              <span className="search__chip" data-testid="search-chip" data-state={searching ? 'searching' : staged ? 'staged' : 'query'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="search__thumb" src={visual.image.url} alt="Attached image" />
                {searching ? (
                  <span className="search__label search__label--searching">SEARCHING…</span>
                ) : chipCategory ? (
                  <span className="search__label" data-testid="search-chip-category">{chipCategory.toUpperCase()}</span>
                ) : null}
              </span>
            )}
            {/* Always mounted (focus survives the search); hidden while searching. */}
            <input
              ref={ref}
              name="q"
              type="search"
              className={searching ? 'search__input is-hidden' : 'search__input'}
              defaultValue={defaultValue || urlValue}
              placeholder={inputPlaceholder}
              aria-label={chipShown ? 'Words to search with the attached image; Enter searches' : 'Search'}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={chipShown ? 200 : undefined}
              onPaste={(e) => {
                if (!visualOn) return
                const file = pickImageFile(e.clipboardData)
                if (!file) return
                e.preventDefault()
                void stage(file)
              }}
            />
          </>
        )}

        {visualOn && !dragOver && (
          <>
            {note && <span className="search__note" role="status" data-testid="search-note">{note}</span>}
            {searching ? (
              <button type="button" className="search__clear" aria-label="Cancel search" onClick={() => cancelVisualSearch()} data-testid="search-clear">
                <XIcon size={12} strokeWidth={1.3} />
              </button>
            ) : chipShown ? (
              <button type="button" className="search__clear" aria-label="Remove the image" onClick={clearQuery} data-testid="search-clear">
                <XIcon size={12} strokeWidth={1.3} />
              </button>
            ) : (
              <span className="search__scan-wrap">
                <button
                  type="button"
                  className="search__scan"
                  aria-label="Add an image to search with"
                  aria-describedby="search-scan-tip"
                  onClick={openImageEntry}
                  data-testid="search-scan-btn"
                >
                  <ScanIcon />
                </button>
                <span className="search__tip" role="tooltip" id="search-scan-tip" data-testid="search-scan-tip">
                  PRESS TO ADD A LOCAL IMAGE · {modKey}K TO PASTE AN IMAGE
                </span>
              </span>
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
              if (f) void stage(f)
            }}
          />
        )}
      </form>

      {visualOn && sheetOpen && (
        <ImageSearchSheet onClose={() => setSheetOpen(false)} onImage={(f) => void stage(f)} />
      )}
    </>
  )
}
