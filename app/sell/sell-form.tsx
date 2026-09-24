'use client'

/**
 * Create / edit a listing — sell page redesign A (single scroll, no step rail):
 * PHOTOS → TITLE / BRAND / CATEGORY / SIZE / COLOR / DESCRIPTION → MEASUREMENTS (TOPS /
 * BOTTOMS) → PRICE + SHIPPING beside the take-home breakdown → a sticky bar with
 * YOU RECEIVE and SAVE DRAFT / PUBLISH.
 *
 * The draft auto-saves as the seller types (POST /api/listings/drafts once, then debounced
 * PATCH /api/listings/[id]); PUBLISH → posts the full listing to /api/listings (anti-slop,
 * pHash, prohibited scan) with `draft_id` so the draft is consumed. `mode: 'edit'` re-opens a
 * published listing: copy, price, measurements, taxonomy and shipping regions are editable,
 * photos are locked (hashed at publish time).
 *
 * Photos are free-ordered (./sell-photos): up to 5, the first is the cover. No condition
 * grade and no possession photo: the design dropped both.
 *
 * Fee math comes from lib/fees (sellerFeeBreakdown) — the same helpers checkout charges with.
 * US shipping is automatic (lib/shipping); international regions are the seller's
 * (lib/shipping-regions, ./sell-shipping).
 */
import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import { createBrowserClient } from '@supabase/ssr'
import { sellerFeeBreakdown, FEE_TIERS, FIXED_FEE_CENTS, STRIPE_PCT_BPS, STRIPE_FIXED_CENTS, WELCOME_SALES } from '@/lib/fees'
import { fmtRate } from '@/lib/tier-dashboard'
import {
  COLORS, measurementDisplayLabel, measurementKindFor, measurementKindIsChoice, measurementKindOf, measurementLabelsForKind,
} from '@/lib/taxonomy'
import { REGION_LABELS, needsIntlRegion } from '@/lib/shipping-regions'
import { countryName } from '@/lib/countries'
import SellCategory from './sell-category'
import SellSize from './sell-size'
import SellPhotos from './sell-photos'
import SellShipping, { regionDraftsFrom, intlFromDrafts, regionMissingPrice, type RegionDrafts } from './sell-shipping'

export type { ListingInitial } from '@/lib/loaders/sell'
import type { ListingInitial } from '@/lib/loaders/sell'

/** Public photo slots on a listing (images[0..4]; the first is the cover). */
export const MAX_PHOTOS = 5

interface SellFormProps {
  userId: string
  sellerBps: number
  welcomeSalesRemaining?: number
  /** The seller's ship-from country now (drafts follow it; a live listing keeps its own). */
  shipsFrom?: string
  /** Existing row: a draft to continue, or a published listing to edit. */
  initial?: ListingInitial | null
  mode?: 'new' | 'edit'
}

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

function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  return [on, () => { setOn(true); window.setTimeout(() => setOn(false), 1400) }]
}

/** Take-home money is shown to the cent: $240.00, −$19.50. */
function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FIXED_LABEL = `${FIXED_FEE_CENTS}¢`

export default function SellForm({ userId, sellerBps, welcomeSalesRemaining = 0, shipsFrom = 'US', initial = null, mode = 'new' }: SellFormProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const origin = initial?.ships_from ?? shipsFrom
  // Storage path prefix: the row id when we have one, else an id for this form instance.
  const instanceId = useId()
  const pathId = useRef(initial?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : instanceId.replace(/[^a-z0-9]/gi, '')))

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // ── form state ──────────────────────────────────────────────────────────────
  const [photos, setPhotos]           = useState<string[]>(() => (initial?.images ?? []).filter(Boolean).slice(0, MAX_PHOTOS))
  const [title, setTitle]             = useState(initial?.title ?? '')
  const [brand, setBrand]             = useState(initial?.brand ?? '')
  const [department, setDepartment]   = useState(initial?.department ?? 'menswear')
  const [category, setCategory]       = useState(initial?.category ?? '')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [size, setSize]               = useState(initial?.size ?? '')
  const [color, setColor]             = useState(initial?.color ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [meas, setMeas]               = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.measurements ?? {}).map(([k, v]) => [k, String(v)])))
  // TOPS / BOTTOMS is the seller's call for garments; the category only sets the default.
  const [measChoice, setMeasChoice]   = useState<'tops' | 'bottoms' | null>(() => measurementKindOf(initial?.measurements ?? null))
  const [priceRaw, setPriceRaw]       = useState(initial?.price_cents ? String(initial.price_cents / 100) : '')
  const [regions, setRegions]         = useState<RegionDrafts>(() => regionDraftsFrom(initial?.intl_shipping ?? {}))

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
  const fees         = sellerFeeBreakdown(priceCents, sellerBps, inWelcome ? 'welcome' : 'tier')
  const tierIdx      = FEE_TIERS.findIndex((t) => t.bps === sellerBps)
  const tierNumber   = tierIdx >= 0 ? FEE_TIERS.length - tierIdx : 1
  const saleNumber   = WELCOME_SALES - welcomeSalesRemaining + 1
  const kindDefault  = measurementKindFor(category || null)
  const kindChoice   = measurementKindIsChoice(category || null)
  const measKind     = kindChoice ? (measChoice ?? kindDefault) : kindDefault
  const measLabels   = measurementLabelsForKind(measKind)
  const measurements = Object.fromEntries(
    measLabels.map((l) => [l, parseFloat((meas[l] ?? '').replace(/[^0-9.]/g, ''))]).filter(([, v]) => Number.isFinite(v as number) && (v as number) > 0),
  ) as Record<string, number>
  const intlShipping = intlFromDrafts(regions, origin)
  const hasIntl      = Object.keys(intlShipping).length > 0

  // ── draft auto-save (debounced) ─────────────────────────────────────────────
  // The payload is rebuilt every render; the timer below always closes over the latest one
  // because every edit re-arms it.
  const draftFields = {
    title, brand, category: category || null, department, subcategory: subcategory || null, size: size || null,
    color: color || null, description, price_cents: priceCents > 0 ? priceCents : null,
    images: photos.map((u) => u.split('?')[0]),
    measurements,
    intl_shipping: intlShipping,
  }

  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const savingRef = useRef(false)
  const draftIdRef = useRef<string | null>(draftId)
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  async function persistDraft(): Promise<string | null> {
    if (isEdit || savingRef.current) return draftIdRef.current
    savingRef.current = true
    setDraftState('saving')
    try {
      const body = draftFields
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
  }

  // Any edit schedules a save 900ms later (first edit creates the draft row).
  const regionsKey = JSON.stringify(intlShipping)
  const measKey = JSON.stringify(measurements)
  const photosKey = photos.join('|')
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (isEdit) return
    dirtyRef.current = true
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void persistDraft() }, 900)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, brand, category, department, subcategory, size, color, description, priceCents, photosKey, measKey, regionsKey])

  // ── image upload ────────────────────────────────────────────────────────────
  const uploadPhoto = useCallback(async (file: File): Promise<string> => {
    const blob = await resizeToJpeg(file)
    const name = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`
    const path = `listings/${userId}/${pathId.current}/${name}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }, [userId, supabase])

  // ── save draft / publish / save edits ───────────────────────────────────────
  async function saveDraftNow() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    await persistDraft()
    flashDraft()
  }

  /** Shipping checks shared by publish and save-edits; returns an error or ''. */
  function shippingError(): string {
    const missing = regionMissingPrice(regions, origin)
    if (missing) return `Set a shipping cost for ${REGION_LABELS[missing]}, or switch it off.`
    if (needsIntlRegion(origin, intlShipping)) return `You ship from ${countryName(origin)}: switch on at least one shipping region.`
    return ''
  }

  async function publish() {
    setSubmitError('')
    if (photos.length === 0) { setSubmitError('Add at least one photo.'); return }
    if (!title.trim()) { setSubmitError('Title is required.'); return }
    if (!brand.trim()) { setSubmitError('Brand is required.'); return }
    if (!category) { setSubmitError('Category is required.'); return }
    if (!size) { setSubmitError('Size is required.'); return }
    if (priceCents <= 0) { setSubmitError('Enter a valid price.'); return }
    const shipErr = shippingError()
    if (shipErr) { setSubmitError(shipErr); return }

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
          price_cents: priceCents,
          images: photos.map((u) => u.split('?')[0]),
          measurements,
          intl_shipping: intlShipping,
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
    const shipErr = shippingError()
    if (shipErr) { setSubmitError(shipErr); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description, price_cents: priceCents, size, color: color || null,
          category, subcategory: subcategory || null, department, measurements,
          intl_shipping: intlShipping,
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

  // ── labels ──────────────────────────────────────────────────────────────────
  const draftLabel = isEdit
    ? 'LIVE · CHANGES APPLY IMMEDIATELY'
    : draftState === 'saving' ? 'SAVING…' : draftState === 'saved' ? 'DRAFT SAVED' : draftState === 'error' ? 'DRAFT NOT SAVED' : 'DRAFT AUTO-SAVES'
  const tierLabel = `TIER ${tierNumber} FEE · ${fmtRate(fees.tierBps)} + ${FIXED_LABEL}`
  const barNote = inWelcome
    ? `COMMISSION WAIVED · SALE ${saleNumber} OF ${WELCOME_SALES}`
    : `TIER ${tierNumber} · ${fmtRate(fees.tierBps)} + ${FIXED_LABEL}`

  const onCategoryPick = (d: string, c: string, s: string) => {
    setDepartment(d || 'menswear'); setCategory(c); setSubcategory(s)
    if (c !== category) { setSize(''); setMeasChoice(null) }
  }

  return (
    <div className="sellx-page">
      <main className="sellx">
        <div className="crumb"><PrefetchLink href="/sell">SELL</PrefetchLink> / {isEdit ? 'EDIT LISTING' : 'NEW LISTING'}</div>
        <div className="sellx__head">
          <h1 className="sellx__title">{isEdit ? 'Edit listing' : 'New listing'}</h1>
          <span className="sellx__state" data-testid="draft-state">{draftLabel}</span>
        </div>

        {/* ── PHOTOS ── */}
        <section className="sellx__sec">
          <div className="sellx__labelrow">
            <span className="sellx__label">PHOTOS</span>
            <span className="sellx__meta">{photos.length} / {MAX_PHOTOS}</span>
          </div>
          <SellPhotos photos={photos} max={MAX_PHOTOS} locked={isEdit} onChange={setPhotos} upload={uploadPhoto} />
          <p className="sellx__hint">{isEdit ? 'Photos are locked once a listing is live.' : 'Drag to reorder. Include the tags.'}</p>
        </section>

        {/* ── DETAILS ── */}
        <section className="sellx__sec sellx__fields">
          <div className="sellx-field">
            <label className="sellx__label" htmlFor="sell-title">TITLE</label>
            <input id="sell-title" className="sellx-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 1998 painter-dyed tee" data-testid="sell-title" />
          </div>
          <div className="sellx-grid">
            <div className="sellx-field">
              <label className="sellx__label" htmlFor="sell-brand">BRAND</label>
              <input id="sell-brand" className="sellx-input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Designer or label" data-testid="sell-brand" />
            </div>
            <div className="sellx-field">
              <label className="sellx__label" htmlFor="sell-category">CATEGORY</label>
              <SellCategory department={department} category={category} subcategory={subcategory} onPick={onCategoryPick} />
            </div>
          </div>
          <div className="sellx-grid sellx-grid--pair">
            <div className="sellx-field">
              <label className="sellx__label" htmlFor="sell-size">SIZE</label>
              <SellSize department={department} category={category} size={size} onPick={setSize} />
            </div>
            <div className="sellx-field">
              <label className="sellx__label" htmlFor="sell-color">COLOR</label>
              <span className="select-wrap">
                <select id="sell-color" className="sellx-input sellx-select" value={color} onChange={(e) => setColor(e.target.value)}>
                  <option value="">Select</option>
                  {COLORS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
                <span className="select-row__caret select-wrap__caret">▾</span>
              </span>
            </div>
          </div>
          <div className="sellx-field">
            <label className="sellx__label" htmlFor="sell-desc">DESCRIPTION</label>
            <textarea id="sell-desc" className="sellx-input sellx-textarea" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fit, wear, provenance" data-testid="sell-desc" />
          </div>
        </section>

        {/* ── MEASUREMENTS ── */}
        <section className="sellx__sec">
          <div className="sellx__labelrow">
            <span className="sellx__label">MEASUREMENTS · IN</span>
            {kindChoice ? (
              <div className="sellx-seg" role="group" aria-label="Measurement type">
                {(['tops', 'bottoms'] as const).map((k) => (
                  <button key={k} type="button" className={`sellx-seg__opt${measKind === k ? ' is-on' : ''}`} aria-pressed={measKind === k} onClick={() => setMeasChoice(k)} data-testid={`meas-${k}`}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            ) : (
              <span className="sellx__meta">{category.toUpperCase()}</span>
            )}
          </div>
          <div className="sellx-meas">
            {measLabels.map((label) => (
              <div key={label} className="sellx-field">
                <label className="sellx__label sellx__label--sub" htmlFor={`meas-${label}`}>{measurementDisplayLabel(label)}</label>
                <input
                  id={`meas-${label}`}
                  className="sellx-input sellx-input--mono"
                  inputMode="decimal"
                  value={meas[label] ?? ''}
                  onChange={(e) => setMeas((m) => ({ ...m, [label]: e.target.value }))}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── PRICE + SHIPPING beside the take-home ── */}
        <section className="sellx__sec sellx-pricing">
          <div className="sellx-pricing__fields">
            <div className="sellx-field">
              <label className="sellx__label" htmlFor="sell-price">PRICE</label>
              <div className="sellx-money">
                <span aria-hidden="true">$</span>
                <input
                  id="sell-price"
                  inputMode="decimal"
                  value={priceRaw}
                  onChange={(e) => setPriceRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  aria-label="Price in USD"
                  data-testid="sell-price"
                />
              </div>
            </div>
            <div className="sellx-field">
              <span className="sellx__label" id="sell-shipping-label">SHIPPING</span>
              <SellShipping origin={origin} drafts={regions} onChange={setRegions} defaultOpen={origin !== 'US' && !hasIntl} />
            </div>
          </div>

          <div className="sellx-fee" data-testid="fee-box">
            <div className="sellx-fee__row"><span>ITEM PRICE</span><span>{money(priceCents)}</span></div>
            <div className="sellx-fee__row"><span>{tierLabel}</span><span>−{money(fees.tierFeeCents)}</span></div>
            {inWelcome && (
              <>
                <div className="sellx-fee__row"><span>WELCOME RAMP · SALE {saleNumber} OF {WELCOME_SALES}</span><span>+{money(fees.waivedCents)}</span></div>
                <div className="sellx-fee__row"><span>CARD PROCESSING · {fmtRate(STRIPE_PCT_BPS)} + {STRIPE_FIXED_CENTS}¢</span><span>−{money(fees.processingCents)}</span></div>
              </>
            )}
            <div className="sellx-fee__row sellx-fee__row--total"><span>YOU RECEIVE</span><span data-testid="fee-payout">{money(fees.payoutCents)}</span></div>
            <p className="sellx-fee__note">
              Buyer pays shipping on top.{' '}
              {inWelcome
                ? `Commission is waived for your first ${WELCOME_SALES} sales; you cover card processing only.`
                : 'The fee includes card processing.'}
              {hasIntl && ' International shipping is added to your payout; you buy that label.'}
            </p>
          </div>
        </section>

        {submitError && <div className="alert-line" role="alert" style={{ paddingTop: 20 }}>{submitError.toUpperCase()}</div>}
      </main>

      {/* Sticky take-home + actions (desktop: one row; ≤720px: amount over two buttons). */}
      <div className="sellx-bar">
        <div className="sellx-bar__take">
          <span className="sellx__label sellx__label--sub">YOU RECEIVE</span>
          <span className="sellx-bar__amount">{money(fees.payoutCents)}</span>
          <span className="sellx-bar__note">{barNote}</span>
        </div>
        <div className="sellx-bar__actions">
          {isEdit ? (
            <>
              <PrefetchLink href="/sell" className="btn-ghost btn-ghost--inline sellx-bar__btn">CANCEL</PrefetchLink>
              <button type="button" className="btn-primary btn-primary--inline sellx-bar__btn sellx-bar__btn--primary" onClick={() => void saveEdits()} disabled={submitting} data-testid="sell-submit">
                {submitting ? 'SAVING…' : pubFlash ? 'SAVED ✓' : 'SAVE CHANGES →'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost btn-ghost--inline sellx-bar__btn" onClick={() => void saveDraftNow()} disabled={draftState === 'saving'} data-testid="sell-save-draft">
                {draftFlash ? 'SAVED ✓' : <><span className="sellx-bar__long">SAVE DRAFT</span><span className="sellx-bar__short">SAVE</span></>}
              </button>
              <button type="button" className="btn-primary btn-primary--inline sellx-bar__btn sellx-bar__btn--primary" onClick={() => void publish()} disabled={submitting} data-testid="sell-submit">
                {submitting ? 'PUBLISHING…' : pubFlash ? 'PUBLISHED ✓' : 'PUBLISH →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
