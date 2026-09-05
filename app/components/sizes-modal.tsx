'use client'

/**
 * "MY SIZES" modal (design options 11A / 11B). MENSWEAR tab = full ranges,
 * 5-col grids; WOMENSWEAR tab = combined alpha/US/EU scales, 3-col grids.
 * Saves to profiles.sizes via PUT /api/settings/sizes, then refreshes the route
 * so server-rendered pages (browse, settings) pick up the new values.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { XIcon } from './icons'
import { SIZE_SECTIONS, normalizeSizes, sizeKey, type SizeDept, type UserSizes } from '@/lib/sizes'

interface Props {
  open: boolean
  onClose: () => void
  initialSizes: UserSizes
  /** Called after a successful save with the saved map (caller may keep local state). */
  onSaved?: (sizes: UserSizes) => void
}

export default function SizesModal({ open, onClose, initialSizes, onSaved }: Props) {
  const router = useRouter()
  const [dept, setDept] = useState<SizeDept>('menswear')
  const [sizes, setSizes] = useState<UserSizes>(() => normalizeSizes(initialSizes))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const sections = SIZE_SECTIONS[dept]

  // Selections are keyed `${dept}:${section}` (lib/sizes contract) — menswear
  // and womenswear tabs keep independent choices.
  const toggle = (key: string, size: string) =>
    setSizes((s) => {
      const cur = s[key] ?? []
      return { ...s, [key]: cur.includes(size) ? cur.filter((x) => x !== size) : [...cur, size] }
    })

  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/settings/sizes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizes }),
    })
    setSaving(false)
    if (!res.ok) {
      setError('COULD NOT SAVE — TRY AGAIN')
      return
    }
    onSaved?.(sizes)
    onClose()
    router.refresh()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="My sizes" onClick={(e) => e.stopPropagation()} data-testid="sizes-modal">
        <div className="modal__head">
          <span className="modal__title">MY SIZES</span>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <XIcon size={11} strokeWidth={1.2} />
          </button>
        </div>
        <div className="modal__desc">Filter out listings that are not in your size.</div>

        <div className="tabs" role="tablist">
          {(['menswear', 'womenswear'] as SizeDept[]).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === dept}
              className={`tab${d === dept ? ' is-active' : ''}`}
              onClick={() => setDept(d)}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {sections.map((section, i) => {
          const key = sizeKey(dept, section.id)
          const chosen = sizes[key] ?? []
          const isOpen = expanded[key] ?? section.defaultOpen ?? false
          const summary = section.scale.filter((s) => chosen.includes(s)).join(' · ')
          return (
            <div key={key}>
              <button
                type="button"
                className="size-sec"
                style={i === 0 ? { borderTop: 'none' } : undefined}
                aria-expanded={isOpen}
                onClick={() => setExpanded((x) => ({ ...x, [key]: !isOpen }))}
              >
                <span className="size-sec__label">{section.label}</span>
                <span className="size-sec__right">
                  {summary && <span className="size-sec__summary">{summary}</span>}
                  <span className="size-sec__caret">{isOpen ? '−' : '+'}</span>
                </span>
              </button>
              {isOpen && (
                <div className={`size-grid size-grid--${section.cols}`}>
                  {section.scale.map((size) => {
                    const on = chosen.includes(size)
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`size-cell${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggle(key, size)}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {error && <div className="alert-line" role="alert">{error}</div>}
        <button type="button" className="btn-primary" onClick={save} disabled={saving} data-testid="sizes-modal-save">
          {saving ? 'SAVING…' : 'SAVE MY SIZES'}
        </button>
      </div>
    </div>
  )
}
