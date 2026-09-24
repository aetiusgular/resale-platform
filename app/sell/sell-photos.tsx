'use client'

/**
 * PHOTOS grid on the listing form (sell page redesign A): up to `max` photos in the
 * seller's own order, the first one is the cover, empty cells are dashed "+" targets.
 * Drag a photo onto another cell to reorder (pointer events, so mouse and touch both
 * work; ← → on a focused photo does the same from the keyboard). Photos are locked once a
 * listing is live.
 */
import { useRef, useState } from 'react'
import { PlusIcon, XIcon } from '@/app/components/icons'

interface Props {
  photos: string[]
  max: number
  locked: boolean
  onChange: (next: string[]) => void
  /** Uploads one file and resolves to its public URL; rejects with a message. */
  upload: (file: File) => Promise<string>
}

type Drag = { from: number; over: number | null; active: boolean; x: number; y: number }

export default function SellPhotos({ photos, max, locked, onChange, upload }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cells = useRef<Array<HTMLDivElement | null>>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= photos.length) return
    const next = [...photos]
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    onChange(next)
  }

  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i))

  async function addFiles(files: FileList | null) {
    if (!files || locked) return
    const room = max - photos.length - pending
    const list = Array.from(files).slice(0, Math.max(0, room))
    if (list.length === 0) return
    setError('')
    setPending((n) => n + list.length)
    const added: string[] = []
    for (const f of list) {
      try {
        added.push(await upload(f))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setPending((n) => n - 1)
      }
    }
    if (added.length) onChange([...photos, ...added].slice(0, max))
  }

  const cellAt = (x: number, y: number): number | null => {
    for (let i = 0; i < photos.length; i++) {
      const r = cells.current[i]?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i
    }
    return null
  }

  const onPointerDown = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (locked || e.button !== 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
    setDrag({ from: i, over: null, active: false, x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const active = drag.active || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6
    if (!active) return
    setDrag({ ...drag, active: true, over: cellAt(e.clientX, e.clientY) })
  }
  const onPointerUp = () => {
    if (drag?.active && drag.over !== null) move(drag.from, drag.over)
    setDrag(null)
  }

  const empty = Math.max(0, max - photos.length - pending)

  return (
    <>
      <div className="sellx-photos" data-testid="sell-photo-grid">
        {photos.map((url, i) => (
          <div
            key={url}
            ref={(el) => { cells.current[i] = el }}
            className={`sellx-photos__cell${drag?.active && drag.from === i ? ' is-dragging' : ''}${drag?.active && drag.over === i && drag.from !== i ? ' is-over' : ''}`}
            tabIndex={locked ? -1 : 0}
            role="listitem"
            aria-label={`Photo ${i + 1} of ${photos.length}${i === 0 ? ', cover' : ''}`}
            onPointerDown={onPointerDown(i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              if (locked) return
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, i - 1) }
              else if (e.key === 'ArrowRight') { e.preventDefault(); move(i, i + 1) }
              else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(i) }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" draggable={false} />
            {i === 0 && <span className="sellx-photos__cover">COVER</span>}
            {!locked && (
              <button
                type="button"
                className="sellx-photos__remove"
                aria-label={`Remove photo ${i + 1}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => remove(i)}
              >
                <XIcon size={9} />
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="sellx-photos__cell sellx-photos__cell--pending" aria-busy="true"><span className="sellx__meta">…</span></div>
        ))}
        {!locked && Array.from({ length: empty }, (_, i) => (
          <button
            key={`add-${i}`}
            type="button"
            className="sellx-photos__add"
            aria-label="Add photo"
            onClick={() => fileInput.current?.click()}
          >
            <PlusIcon />
          </button>
        ))}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }}
        aria-label="Upload photos"
      />
      {error && <div className="alert-line" role="alert">{error.toUpperCase()}</div>}
    </>
  )
}
