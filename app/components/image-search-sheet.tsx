'use client'

/**
 * Search by image — mobile bottom sheet (design page 21, M1). Opened by the scan glyph in
 * the ≤720px search row. Three rows: Take a photo (camera capture), Choose from photos
 * (library), Paste from clipboard (navigator.clipboard.read; iOS shows its own paste
 * prompt). The photo is staged in the search row (thumb chip); the keyboard's Search key
 * runs the query, with any words typed next to it. Nothing is stored.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CameraIcon, ClipboardIcon, PhotosIcon, XIcon } from './icons'
import { readClipboardImage } from '@/lib/visual-search/clipboard'
import { QUERY_IMAGE_TYPES } from '@/lib/visual-search/shared'

type Props = {
  onClose: () => void
  onImage: (file: Blob) => void
}

export default function ImageSearchSheet({ onClose, onImage }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (f) onImage(f)
  }

  const paste = async () => {
    const blob = await readClipboardImage()
    if (blob) { onImage(blob); return }
    setNote('NO IMAGE ON THE CLIPBOARD · COPY ONE, OR LONG-PRESS PASTE IN THE SEARCH FIELD')
  }

  // Portal: the header is a sticky stacking context (z 40) below the browse dock (z 45); the
  // scrim (z 50) must sit on body to cover the dock like the sort sheet does.
  return createPortal(
    <div className="scrim scrim--sheet" onClick={onClose} data-testid="image-search-scrim">
      <div
        className="sheet vs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Search by image"
        onClick={(e) => e.stopPropagation()}
        data-testid="image-search-sheet"
      >
        <div className="sheet__head">
          <span className="modal__title">SEARCH BY IMAGE</span>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <XIcon size={12} strokeWidth={1.3} />
          </button>
        </div>
        <button type="button" className="vs-sheet__row" onClick={() => cameraRef.current?.click()} data-testid="sheet-take-photo">
          <span className="vs-sheet__icon"><CameraIcon /></span>
          <span className="vs-sheet__text">Take a photo</span>
          <span className="vs-sheet__tag">CAMERA</span>
        </button>
        <button type="button" className="vs-sheet__row" onClick={() => libraryRef.current?.click()} data-testid="sheet-choose-photos">
          <span className="vs-sheet__icon"><PhotosIcon /></span>
          <span className="vs-sheet__text">Choose from photos</span>
          <span className="vs-sheet__tag">LIBRARY</span>
        </button>
        <button type="button" className="vs-sheet__row" onClick={() => void paste()} data-testid="sheet-paste">
          <span className="vs-sheet__icon"><ClipboardIcon /></span>
          <span className="vs-sheet__text">Paste from clipboard</span>
        </button>
        <div className="vs-sheet__note" data-testid="sheet-note">{note ?? 'Your photo is searched, not stored. Add words, then search.'}</div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="search__file" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="sheet-camera-input" />
        <input ref={libraryRef} type="file" accept={QUERY_IMAGE_TYPES.join(',')} className="search__file" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="sheet-library-input" />
      </div>
    </div>,
    document.body,
  )
}
