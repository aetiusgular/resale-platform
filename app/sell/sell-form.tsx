'use client'

/**
 * Create-listing wizard (reference WizardView): steps rail on the left (01 PHOTOS
 * · 02 DETAILS · 03 MEASUREMENTS · 04 PRICING · 05 REVIEW with live meta), one
 * long form on the right. The draft auto-saves as the seller types
 * (POST /api/listings/drafts once, then debounced PATCH /api/listings/[id]);
 * PUBLISH LISTING → posts the full listing to /api/listings (anti-slop, pHash,
 * prohibited scan) with `draft_id` so the draft is consumed. `mode: 'edit'`
 * re-opens a published listing: copy, price, measurements and taxonomy are
 * editable, photos are locked (hashed at publish time).
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import { createBrowserClient } from '@supabase/ssr'
import { sellerFeeAt, formatCents, welcomeSellerFeeCents, FEE_TIERS } from '@/lib/fees'
import { floorShippingCents } from '@/lib/shipping'
import { fmtRate } from '@/lib/tier-dashboard'
import { CONDITION_DEFINITIONS, PHOTO_SLOTS } from '@/lib/condition'
import { CATEGORY_TREE, COLORS, DEPARTMENTS, measurementLabelsFor } from '@/lib/taxonomy'
import { sizeScaleFor } from '@/lib/sizes'
import { PlusIcon, XIcon } from '@/app/components/icons'

const SLOT_LABELS: Record<string, string> = {
  FRONT: 'FRONT', BACK: 'BACK', TAG: 'TAG', DETAIL: 'DETAIL', FLAW: 'FLAW', POSSESSION: 'POSSESSION',
}
const WIZARD_STEPS = ['01 PHOTOS', '02 DETAILS', '03 MEASUREMENTS', '04 PRICING', '05 REVIEW']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export interface ListingInitial {
  id: string
  status: string
  title: string | null
  brand: string | null
  category: string | null
  department: string | null
  subcategory: string | null
  size: string | null
  color: string | null
  description: string | null
  condition_score: number | null
  price_cents: number | null
  images: string[]
  possession_photo_url: string | null
  measurements: Record<string, number>
}

interface SellFormProps {
  userId: string
  sellerBps: number
  welcomeSalesRemaining?: number
  /** Existing row: a draft to continue, or a published listing to edit. */
  initial?: ListingInitial | null
  mode?: 'new' | 'edit'
}

type SlotUploading = { [key: string]: boolean }
type SlotUrls = { [key: string]: string }
type SlotErrors = { [key: string]: string }

async function resizeToJpeg(file: File, maxPx = 2000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas blob failed'))),
        'image/jpeg',
        0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="review-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{children}</span>
      {right && <em>{right}</em>}
    </div>
  )
}

function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  return [on, () => { setOn(true); window.setTimeout(() => setOn(false), 1400) }]
}

/** Category select value: "menswear|Tops|Short-sleeve tees" — dept / category / subcategory. */
const catValue = (dept: string, cat: string, sub: string) => [dept, cat, sub].join('|')

export default function SellForm({ userId, sellerBps, welcomeSalesRemaining = 0, initial = null, mode = 'new' }: SellFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  // Storage path prefix: the row id when we have one, else a session id.
  const pathId = useRef(initial?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2)))

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // ── form state ──────────────────────────────────────────────────────────────
  const initialSlots: SlotUrls = {}
  if (initial) {
    PHOTO_SLOTS.forEach((slot, i) => { const u = initial.images[i]; if (u) initialSlots[slot] = u })
    if (initial.possession_photo_url) initialSlots.POSSESSION = initial.possession_photo_url
  }
  const [slotUrls, setSlotUrls]         = useState<SlotUrls>(initialSlots)
  const [uploading, setUploading]       = useState<SlotUploading>({})
  const [uploadErrors, setUploadErrors] = useState<SlotErrors>({})

  const [title, setTitle]             = useState(initial?.title ?? '')
  const [brand, setBrand]             = useState(initial?.brand ?? '')
  const [department, setDepartment]   = useState(initial?.department ?? 'menswear')
  const [category, setCategory]       = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [size, setSize]               = useState(initial?.size ?? '')
  const [color, setColor]             = useState(initial?.color ?? '')
  const [conditionScore, setConditionScore] = useState<number | null>(initial?.condition_score ?? null)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [meas, setMeas]               = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.measurements ?? {}).map(([k, v]) => [k, String(v)])))
  const [priceRaw, setPriceRaw]       = useState(initial?.price_cents ? String(initial.price_cents / 100) : '')

  const [draftId, setDraftId]         = useState<string | null>(initial && initial.status === 'draft' ? initial.id : null)
  const [draftState, setDraftState]   = useState<'idle' | 'saving' | 'saved' | 'error'>(initial ? 'saved' : 'idle')
  const [draftFlash, flashDraft]      = useFlash()
  const [pubFlash, flashPub]          = useFlash()
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── derived ─────────────────────────────────────────────────────────────────
  const priceDollars = parseFloat(priceRaw.replace(/[^0-9.]/g, ''))
  const priceCents   = Number.isFinite(priceDollars) ? Math.round(priceDollars * 100) : 0
  const inWelcome    = welcomeSalesRemaining > 0
  const estShipping  = floorShippingCents(category || 'Other')
  const tierFee      = priceCents > 0 ? sellerFeeAt(priceCents, sellerBps) : 0
  const cardCost     = priceCents > 0 && inWelcome ? welcomeSellerFeeCents(priceCents, estShipping) : 0
  const feeAmount    = inWelcome ? cardCost : tierFee
  const payoutAmount = priceCents > 0 ? priceCents - feeAmount : 0
  const tierIdx      = FEE_TIERS.findIndex((t) => t.bps === sellerBps)
  const tierNumber   = tierIdx >= 0 ? FEE_TIERS.length - tierIdx : 1
  const measLabels   = measurementLabelsFor(category || null)
  const measurements = Object.fromEntries(
    measLabels.map((l) => [l, parseFloat((meas[l] ?? '').replace(/[^0-9.]/g, ''))]).filter(([, v]) => Number.isFinite(v as number) && (v as number) > 0),
  ) as Record<string, number>
  const sizeOptions  = sizeScaleFor(department, category)

  // ── draft auto-save (debounced) ─────────────────────────────────────────────
  const fields = useCallback(() => ({
    title, brand, category: category || null, department, subcategory: subcategory || null, size: size || null,
    color: color || null, description, condition_score: conditionScore, price_cents: priceCents > 0 ? priceCents : null,
    images: PHOTO_SLOTS.slice(0, 5).map((slot) => (slotUrls[slot] ?? '').split('?')[0]),
    possession_photo_url: slotUrls.POSSESSION ? slotUrls.POSSESSION.split('?')[0] : null,
    measurements,
  }), [title, brand, category, department, subcategory, size, color, description, conditionScore, priceCents, slotUrls, measurements])

  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const savingRef = useRef(false)
  const draftIdRef = useRef<string | null>(draftId)
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  const persistDraft = useCallback(async (): Promise<string | null> => {
    if (isEdit || savingRef.current) return draftIdRef.current
    savingRef.current = true
    setDraftState('saving')
    try {
      const body = fields()
      if (draftIdRef.current) {
        const res = await fetch(`/api/listings/${draftIdRef.current}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok && res.status !== 400) throw new Error('patch failed')
      } else {
        const res = await fetch('/api/listings/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error('create failed')
        const d = await res.json()
        draftIdRef.current = d.id
        setDraftId(d.id)
        window.history.replaceState(null, '', `/sell/new?draft=${d.id}`)
      }
      dirtyRef.current = false
      setDraftState('saved')
      return draftIdRef.current
    } catch {
      setDraftState('error')
      return draftIdRef.current
    } finally {
      savingRef.current = false
    }
  }, [fields, isEdit])

  // Any edit schedules a save 900ms later (first edit creates the draft row).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (isEdit) return
    dirtyRef.current = true
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void persistDraft() }, 900)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, brand, category, department, subcategory, size, color, description, conditionScore, priceCents, slotUrls, meas])

  // ── image upload ────────────────────────────────────────────────────────────
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleSlotClick = (slot: string) => {
    if (uploading[slot] || isEdit) return
    fileInputRefs.current[slot]?.click()
  }

  const handleFileChange = useCallback(
    async (slot: string, file: File | null) => {
      if (!file) return
      setUploading((u) => ({ ...u, [slot]: true }))
      setUploadErrors((e) => ({ ...e, [slot]: '' }))
      try {
        const blob = await resizeToJpeg(file)
        const path = `listings/${userId}/${pathId.current}/${slot.toLowerCase()}.jpg`
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        setSlotUrls((u) => ({ ...u, [slot]: `${data.publicUrl}?v=${Date.now()}` }))
      } catch (err) {
        setUploadErrors((e) => ({ ...e, [slot]: err instanceof Error ? err.message : 'upload failed' }))
      } finally {
        setUploading((u) => ({ ...u, [slot]: false }))
      }
    },
    [userId, supabase],
  )

  const removeSlot = (slot: string) => {
    setSlotUrls((u) => { const n = { ...u }; delete n[slot]; return n })
  }

  // ── save draft / publish / save edits ───────────────────────────────────────
  async function saveDraftNow() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    await persistDraft()
    flashDraft()
  }

  async function publish() {
    setSubmitError('')
    if (!slotUrls.FRONT) { setSubmitError('Front photo is required.'); return }
    if (!slotUrls.POSSESSION) { setSubmitError('Possession photo is required.'); return }
    if (!brand.trim()) { setSubmitError('Brand is required.'); return }
    if (!category) { setSubmitError('Category is required.'); return }
    if (!size) { setSubmitError('Size is required.'); return }
    if (!title.trim()) { setSubmitError('Title is required.'); return }
    if (!conditionScore) { setSubmitError('Condition grade is required.'); return }
    if (priceCents <= 0) { setSubmitError('Enter a valid price.'); return }

    setSubmitting(true)
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      const id = draftIdRef.current
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          brand: brand.trim(),
          category,
          department,
          subcategory: subcategory || null,
          size,
          color: color || null,
          description,
          condition_score: conditionScore,
          condition_notes: {},
          price_cents: priceCents,
          images: PHOTO_SLOTS.map((slot) => (slotUrls[slot] ?? '').split('?')[0]),
          possession_photo_url: (slotUrls.POSSESSION ?? '').split('?')[0],
          measurements,
          draft_id: id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error ?? 'Submission failed.')
        return
      }
      flashPub()
      window.setTimeout(() => { router.push('/sell'); router.refresh() }, 1200)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveEdits() {
    if (!initial) return
    setSubmitError('')
    if (priceCents <= 0) { setSubmitError('Enter a valid price.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description, price_cents: priceCents, size, color: color || null,
          category, subcategory: subcategory || null, department, measurements, condition_score: conditionScore,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error ?? 'Could not save changes.')
        return
      }
      flashPub()
      window.setTimeout(() => { router.push('/sell'); router.refresh() }, 1200)
    } finally {
      setSubmitting(false)
    }
  }

  // ── rail meta ───────────────────────────────────────────────────────────────
  const filledCount = PHOTO_SLOTS.filter((s) => slotUrls[s]).length
  const detailsDone = !!(brand.trim() && category && size && title.trim() && conditionScore)
  const measCount = Object.keys(measurements).length
  const stepDone = [
    !!slotUrls.FRONT && !!slotUrls.POSSESSION,
    detailsDone,
    measCount > 0,
    priceCents > 0,
    false,
  ]
  const stepMeta = [`${filledCount}/6`, detailsDone ? '✓' : '', measCount > 0 ? `${measCount} SET` : '', priceCents > 0 ? `$${Math.round(priceCents / 100)}` : '—', '']
  const currentStep = Math.max(0, stepDone.findIndex((d) => !d))
  const draftLabel = isEdit ? 'EDITING' : draftState === 'saving' ? 'SAVING…' : draftState === 'saved' ? 'DRAFT ✓' : draftState === 'error' ? 'NOT SAVED' : 'DRAFT'
  const headNote = isEdit
    ? `LIVE LISTING · CHANGES APPLY IMMEDIATELY`
    : `${draftState === 'saved' ? 'DRAFT AUTO-SAVED' : draftState === 'saving' ? 'SAVING DRAFT…' : draftState === 'error' ? 'DRAFT NOT SAVED' : 'DRAFT AUTO-SAVES'} · STEP ${currentStep + 1} OF 5`

  const categoryValue = category ? catValue(department, category, subcategory) : ''
  const onCategoryChange = (v: string) => {
    const [d, c, s] = v.split('|')
    setDepartment(d || 'menswear'); setCategory(c || ''); setSubcategory(s || '')
    if (c !== category) setSize('')
  }

  return (
    <div className="layout">
      <aside className="rail">
        <div className="rail__top">
          <span className="rail__title">{isEdit ? 'EDIT LISTING' : 'NEW LISTING'}</span>
          <span className="rail__handle" data-testid="draft-state">{draftLabel}</span>
        </div>
        {WIZARD_STEPS.map((s, i) => {
          const on = i === currentStep
          return (
            <div key={s} className={`side-link${i === WIZARD_STEPS.length - 1 ? ' side-link--last' : ''}`}>
              <span className="side-link__left">
                <span className={`dot${on || stepDone[i] ? ' is-on' : ''}`} />
                <span className={`side-link__label${on ? ' is-on' : ''}`}>{s}</span>
              </span>
              {stepMeta[i] && <span className="side-link__meta">{stepMeta[i]}</span>}
            </div>
          )
        })}
        <div className="wizard-rail-note">
          TIER {tierNumber} SELLER<br />
          FEE {fmtRate(sellerBps)}{inWelcome ? ` · RAMP −${fmtRate(sellerBps)}` : ''}<br />
          {isEdit ? 'PHOTOS ARE LOCKED ONCE LIVE' : 'FIRST BUMP FREE ON PUBLISH'}
        </div>
      </aside>

      <main className="main main--settings">
        <div className="settings-body">
          <div className="crumb"><PrefetchLink href="/sell">SELL</PrefetchLink> / {isEdit ? 'EDIT LISTING' : 'NEW LISTING'}</div>
          <div className="page-head page-head--ruled">
            <h1 className="page-title">{isEdit ? 'Edit listing' : 'New listing'}</h1>
            <span className="page-note">{headNote}</span>
          </div>

          {/* ── 01 PHOTOS ── */}
          <SectionLabel right={`${filledCount} / 6 · FRONT + POSSESSION REQUIRED · DUPLICATE CHECK (PHASH) ON UPLOAD`}>01 — PHOTOS</SectionLabel>
          <div className="slots" data-testid="sell-photo-grid">
            {PHOTO_SLOTS.map((slot) => {
              const url  = slotUrls[slot]
              const busy = uploading[slot]
              const err  = uploadErrors[slot]
              return (
                <div key={slot}>
                  {url ? (
                    <span className="slot__img" style={{ display: 'block', position: 'relative', overflow: 'hidden' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {!isEdit && (
                        <button type="button" className="card__unsave" aria-label={`Remove ${slot}`} onClick={() => removeSlot(slot)} style={{ top: 6, right: 6 }}>
                          <XIcon size={9} />
                        </button>
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="slot__add"
                      style={{ borderStyle: err ? 'dashed' : 'solid', borderColor: err ? 'var(--alert)' : undefined }}
                      aria-label={`Add ${slot} photo`}
                      onClick={() => handleSlotClick(slot)}
                      disabled={busy || isEdit}
                    >
                      {busy ? <span className="mono-note">…</span> : <PlusIcon />}
                    </button>
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[slot] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(slot, e.target.files?.[0] ?? null)}
                    aria-label={`Upload ${slot} photo`}
                  />
                  <div className={`slot__label${url ? ' is-filled' : ''}`}>{SLOT_LABELS[slot]}{url ? ' ✓' : ''}</div>
                  {err && <div className="alert-line" style={{ paddingTop: 4 }}>{err.toUpperCase()}</div>}
                </div>
              )
            })}
          </div>
          <div className="settings-note" style={{ paddingTop: 12 }}>
            POSSESSION = a handwritten tag with your username and today&rsquo;s date, in frame with the item. Tag and flaw photos are archived as evidence.
          </div>

          {/* ── 02 DETAILS ── */}
          <SectionLabel>02 — DETAILS</SectionLabel>
          <div className="field-grid" style={{ paddingTop: 0 }}>
            <div>
              <label className="field-label" htmlFor="sell-title">TITLE</label>
              <input id="sell-title" className="input-sans" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 1998 painter-dyed tee" data-testid="sell-title" />
            </div>
            <div>
              <label className="field-label" htmlFor="sell-brand">BRAND</label>
              <input id="sell-brand" className="input-sans" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Designer or label" data-testid="sell-brand" />
            </div>
            <div>
              <label className="field-label" htmlFor="sell-category">CATEGORY</label>
              <span className="select-wrap">
                <select id="sell-category" className="select-row" value={categoryValue} onChange={(e) => onCategoryChange(e.target.value)} data-testid="sell-category">
                  <option value="" disabled>Department / Category</option>
                  {DEPARTMENTS.map((d) => (
                    <optgroup key={d} label={cap(d)}>
                      {CATEGORY_TREE.flatMap((node) => [
                        <option key={catValue(d, node.label, '')} value={catValue(d, node.label, '')}>{cap(d)} / {node.label}</option>,
                        ...node.children.map((sub) => (
                          <option key={catValue(d, node.label, sub)} value={catValue(d, node.label, sub)}>{cap(d)} / {node.label} / {sub}</option>
                        )),
                      ])}
                    </optgroup>
                  ))}
                </select>
                <span className="select-row__caret select-wrap__caret">▾</span>
              </span>
            </div>
            <div>
              <label className="field-label" htmlFor="sell-size">SIZE</label>
              <span className="select-wrap">
                <select id="sell-size" className="select-row" value={size} onChange={(e) => setSize(e.target.value)} data-testid="sell-size">
                  <option value="" disabled>{category ? 'Choose a size' : 'Pick a category first'}</option>
                  {size && !sizeOptions.includes(size) && <option value={size}>{size}</option>}
                  {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="select-row__caret select-wrap__caret">▾</span>
              </span>
            </div>
            <div>
              <label className="field-label" htmlFor="sell-color">COLOR</label>
              <span className="select-wrap">
                <select id="sell-color" className="select-row" value={color} onChange={(e) => setColor(e.target.value)}>
                  <option value="">Not set</option>
                  {COLORS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
                <span className="select-row__caret select-wrap__caret">▾</span>
              </span>
            </div>
            <div>
              <label className="field-label" htmlFor="sell-condition">CONDITION</label>
              <span className="select-wrap">
                <select id="sell-condition" className="select-row" value={conditionScore ?? ''} onChange={(e) => setConditionScore(e.target.value ? Number(e.target.value) : null)} data-testid="sell-condition">
                  <option value="" disabled>Grade 1–10</option>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                    <option key={n} value={n}>{n} / 10 — {CONDITION_DEFINITIONS[n]}</option>
                  ))}
                </select>
                <span className="select-row__caret select-wrap__caret">▾</span>
              </span>
            </div>
          </div>
          <div className="field-block">
            <label className="field-label" htmlFor="sell-desc">DESCRIPTION</label>
            <textarea id="sell-desc" className="review-text" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provenance, fit, wear —" data-testid="sell-desc" />
            <div className="review-count"><span>CONDITION, FLAWS AND PROVENANCE — BE SPECIFIC</span><span>{description.length} / 1000</span></div>
          </div>

          {/* ── 03 MEASUREMENTS ── */}
          <SectionLabel right="FLAT · INCHES — SHOWN ON THE LISTING">03 — MEASUREMENTS</SectionLabel>
          <div className="meas-grid">
            {measLabels.map((label) => (
              <div key={label}>
                <div className="field-label">{label}</div>
                <input
                  className="input-mono"
                  inputMode="decimal"
                  value={meas[label] ?? ''}
                  onChange={(e) => setMeas((m) => ({ ...m, [label]: e.target.value }))}
                  placeholder={'—"'}
                  aria-label={label}
                />
              </div>
            ))}
          </div>

          {/* ── 04 PRICING ── */}
          <SectionLabel>04 — PRICING</SectionLabel>
          <div className="price-flex">
            <div className="price-flex__fields field-grid" style={{ padding: 0 }}>
              <div>
                <label className="field-label" htmlFor="sell-price">PRICE — USD</label>
                <input
                  id="sell-price"
                  className="input-mono"
                  inputMode="decimal"
                  value={priceRaw}
                  onChange={(e) => setPriceRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  aria-label="Price in USD"
                  data-testid="sell-price"
                />
              </div>
              <div>
                <div className="field-label">SHIPPING</div>
                <div className="select-row" style={{ cursor: 'default' }} title="Calculated by item type — prepaid label">
                  Buyer pays — {formatCents(estShipping)} flat
                  <span className="select-row__caret">▾</span>
                </div>
              </div>
            </div>
            <div className="fee-box" data-testid="fee-box">
              <div className="fee-box__title">FEE MATH — LIVE</div>
              <div className="fee-row"><span>ITEM PRICE</span><span>{formatCents(priceCents)}</span></div>
              <div className="fee-row"><span>TIER {tierNumber} FEE — {fmtRate(sellerBps)}</span><span>−{formatCents(tierFee)}</span></div>
              {inWelcome && (
                <>
                  <div className="fee-row"><span>WELCOME RAMP −{fmtRate(sellerBps)}</span><span>+{formatCents(tierFee)}</span></div>
                  <div className="fee-row"><span>CARD PROCESSING (EST.)</span><span>−{formatCents(cardCost)}</span></div>
                </>
              )}
              <div className="fee-row fee-row--total"><span>YOU RECEIVE</span><span>{formatCents(payoutAmount)}</span></div>
            </div>
          </div>

          {/* ── 05 REVIEW ── */}
          {submitError && <div className="alert-line" role="alert" style={{ paddingTop: 16 }}>{submitError.toUpperCase()}</div>}
          <div className="save-row save-row--left wizard-foot">
            {isEdit ? (
              <>
                <PrefetchLink href="/sell" className="btn-ghost btn-ghost--inline">CANCEL</PrefetchLink>
                <button type="button" className="btn-primary btn-primary--inline" onClick={() => void saveEdits()} disabled={submitting} data-testid="sell-submit">
                  {submitting ? 'SAVING…' : pubFlash ? 'SAVED ✓' : 'SAVE CHANGES →'}
                </button>
                <span className="page-note">A PRICE CUT NOTIFIES EVERYONE WHO SAVED IT</span>
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost btn-ghost--inline" onClick={() => void saveDraftNow()} disabled={draftState === 'saving'} data-testid="sell-save-draft">
                  {draftFlash ? 'DRAFT SAVED ✓' : 'SAVE DRAFT'}
                </button>
                <button type="button" className="btn-primary btn-primary--inline" onClick={() => void publish()} disabled={submitting} data-testid="sell-submit">
                  {submitting ? 'PUBLISHING…' : pubFlash ? 'PUBLISHED ✓' : 'PUBLISH LISTING →'}
                </button>
                <span className="page-note">PUBLISHING TRIGGERS YOUR FREE FIRST BUMP</span>
              </>
            )}
          </div>
        </div>
        <div className="pdp-dock">
          {isEdit ? (
            <>
              <PrefetchLink href="/sell" className="btn-ink">CANCEL</PrefetchLink>
              <button type="button" className="btn-primary" onClick={() => void saveEdits()} disabled={submitting}>{submitting ? 'SAVING…' : pubFlash ? 'SAVED ✓' : 'SAVE →'}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ink" onClick={() => void saveDraftNow()}>{draftFlash ? 'SAVED ✓' : 'SAVE DRAFT'}</button>
              <button type="button" className="btn-primary" onClick={() => void publish()} disabled={submitting}>{submitting ? 'PUBLISHING…' : pubFlash ? 'PUBLISHED ✓' : 'PUBLISH →'}</button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
