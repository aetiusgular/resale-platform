'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { sellerFee, sellerPayout, formatCents } from '@/lib/fees'
import {
  CONDITION_DEFINITIONS,
  PHOTO_SLOTS,
  DAMAGE_FLAGS,
  type DamageFlag,
} from '@/lib/condition'

const CATEGORIES = [
  'Outerwear', 'Tops', 'Bottoms', 'Footwear', 'Accessories',
  'Knitwear', 'Denim', 'Tailoring', 'Sportswear', 'Other',
]

const SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL',
  'XS / 44', 'S / 46', 'M / 48', 'L / 50', 'XL / 52', 'XXL / 54',
  'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12',
  'US 6', 'US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12',
  'One Size',
]

interface SellFormProps {
  userId: string
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

export default function SellForm({ userId }: SellFormProps) {
  // Draft ID — stable for this session; used as storage path prefix
  const draftId = useRef(
    typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  )

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // ── form state ──────────────────────────────────────────────────────────────
  const [slotUrls, setSlotUrls]         = useState<SlotUrls>({})
  const [uploading, setUploading]       = useState<SlotUploading>({})
  const [uploadErrors, setUploadErrors] = useState<SlotErrors>({})

  const [brand, setBrand]             = useState('')
  const [category, setCategory]       = useState('')
  const [size, setSize]               = useState('')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')

  const [conditionScore, setConditionScore]       = useState<number | null>(null)
  const [damageFlags, setDamageFlags]             = useState<DamageFlag[]>([])
  const [damageNotes, setDamageNotes]             = useState<Record<DamageFlag, string>>({
    stains: '', repairs: '', fading: '', odor: '',
  })

  const [priceRaw, setPriceRaw] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted]     = useState(false)
  const [submittedId, setSubmittedId] = useState('')

  // ── price calculation ───────────────────────────────────────────────────────
  const priceDollars = parseFloat(priceRaw.replace(/[^0-9.]/g, ''))
  const priceCents   = Number.isFinite(priceDollars) ? Math.round(priceDollars * 100) : 0
  const feeAmount    = priceCents > 0 ? sellerFee(priceCents) : 0
  const payoutAmount = priceCents > 0 ? sellerPayout(priceCents) : 0

  // ── image upload ────────────────────────────────────────────────────────────
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleSlotClick = (slot: string) => {
    if (uploading[slot]) return
    fileInputRefs.current[slot]?.click()
  }

  const handleFileChange = useCallback(
    async (slot: string, file: File | null) => {
      if (!file) return
      setUploading((u) => ({ ...u, [slot]: true }))
      setUploadErrors((e) => ({ ...e, [slot]: '' }))
      try {
        const blob = await resizeToJpeg(file)
        const path = `listings/${userId}/${draftId.current}/${slot.toLowerCase()}.jpg`
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        setSlotUrls((u) => ({ ...u, [slot]: data.publicUrl }))
      } catch (err) {
        setUploadErrors((e) => ({
          ...e,
          [slot]: err instanceof Error ? err.message : 'upload failed',
        }))
      } finally {
        setUploading((u) => ({ ...u, [slot]: false }))
      }
    },
    [userId, supabase],
  )

  const removeSlot = (slot: string) => {
    setSlotUrls((u) => { const n = { ...u }; delete n[slot]; return n })
  }

  // ── damage flag toggle ──────────────────────────────────────────────────────
  const toggleFlag = (flag: DamageFlag) => {
    setDamageFlags((f) =>
      f.includes(flag) ? f.filter((x) => x !== flag) : [...f, flag],
    )
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError('')
    if (!slotUrls['FRONT']) { setSubmitError('Front photo is required.'); return }
    if (!slotUrls['POSSESSION']) { setSubmitError('Possession photo is required.'); return }
    if (!brand.trim()) { setSubmitError('Brand is required.'); return }
    if (!category) { setSubmitError('Category is required.'); return }
    if (!size) { setSubmitError('Size is required.'); return }
    if (!title.trim()) { setSubmitError('Title is required.'); return }
    if (!conditionScore) { setSubmitError('Condition score is required.'); return }
    if (priceCents <= 0) { setSubmitError('Enter a valid price.'); return }

    const images = PHOTO_SLOTS.map((slot) => slotUrls[slot] ?? '')

    const condition_notes: Record<string, unknown> = {
      damage: damageFlags,
      notes: Object.fromEntries(
        damageFlags
          .filter((f) => damageNotes[f])
          .map((f) => [f, damageNotes[f]]),
      ),
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          brand: brand.trim(),
          category,
          size,
          description,
          condition_score: conditionScore,
          condition_notes,
          price_cents: priceCents,
          images,
          possession_photo_url: slotUrls['POSSESSION'],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error ?? 'Submission failed.')
        return
      }
      const data = await res.json()
      setSubmittedId(data.id)
      setSubmitted(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── submitted state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '112px' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: '28px', lineHeight: 1.35, color: 'var(--color-ink)', margin: 0 }}>
          In the queue.
        </p>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)' }}>
          REVIEW: PENDING · YOUR LISTING IS QUEUED
        </div>
        <button
          style={{ fontSize: '14px', color: 'var(--color-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '3px', padding: 0 }}
          onClick={() => window.location.reload()}
        >
          list another
        </button>

        {/* Seller Protection card */}
        <div style={{ marginTop: '32px', width: '480px', maxWidth: '90%', border: '1px solid var(--color-line)', borderRadius: '2px' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>
            Seller protection
          </div>
          {[
            { label: 'EVIDENCE ARCHIVED', desc: '— your photos are timestamped and stored' },
            { label: 'AUTO-RELEASE', desc: '— you\'re paid 3 days after delivery unless a dispute is opened' },
            { label: 'VERIFIED BUYERS ONLY', desc: '— every buyer is ID-checked, you see their record' },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '12px 16px', borderTop: '1px solid var(--color-line)' }}>
              <span style={{ color: 'var(--color-accent)', fontSize: '13px', flex: 'none' }}>✓</span>
              <span style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-ink)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }}>{row.label}</span>{' '}
                <span style={{ color: 'var(--color-ink-soft)' }}>{row.desc}</span>
              </span>
            </div>
          ))}
        </div>

        {submittedId && (
          <Link href={`/listings/${submittedId}`} style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-ink-soft)' }}>
            view your listing →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 96px' }}>

      {/* ── STEP 1: PHOTOS ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid var(--color-line)', paddingBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink-soft)' }}>01</span>
          <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Photos</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '24px' }}>
          {PHOTO_SLOTS.map((slot) => {
            const url   = slotUrls[slot]
            const busy  = uploading[slot]
            const err   = uploadErrors[slot]
            const isPossession = slot === 'POSSESSION'
            const label = slot.charAt(0) + slot.slice(1).toLowerCase()

            return (
              <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '3/4',
                    boxSizing: 'border-box',
                    border: `1px ${url ? 'solid var(--color-ink)' : err ? 'dashed var(--color-alert)' : 'dashed var(--color-line)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: busy ? 'wait' : 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 120ms linear',
                  }}
                  onClick={() => url ? undefined : handleSlotClick(slot)}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : busy ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-ink-soft)' }}>…</span>
                  ) : (
                    <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: err ? 'var(--color-alert)' : 'var(--color-ink-soft)' }}>{label}</span>
                  )}
                  {url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSlot(slot) }}
                      style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', background: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', color: 'var(--color-ink)' }}
                      aria-label={`Remove ${slot}`}
                    >×</button>
                  )}
                  {isPossession && url && (
                    <span style={{ position: 'absolute', top: '4px', left: '4px', width: '16px', height: '16px', background: 'var(--color-accent)', borderRadius: '2px', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                  )}
                </div>
                <input
                  ref={(el) => { fileInputRefs.current[slot] = el }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(slot, e.target.files?.[0] ?? null)}
                  aria-label={`Upload ${slot} photo`}
                />
                <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: url ? 'var(--color-ink)' : 'var(--color-ink-soft)', textAlign: 'center' }}>{label}</span>
                {err && <span style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-alert)' }}>{err}</span>}
                {isPossession && !url && (
                  <span style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-ink-soft)' }}>
                    handwritten tag with your username + today&apos;s date, in frame with the item.
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: '16px', fontSize: '12px', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
          your tag, serial, and flaw photos are archived as evidence — if a buyer ever disputes with a swapped item, these protect you.
        </div>
      </div>

      {/* ── STEP 2: DETAILS ── */}
      <div style={{ marginTop: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid var(--color-line)', paddingBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink-soft)' }}>02</span>
          <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Details</span>
        </div>

        {/* Brand */}
        <div style={{ marginTop: '28px', position: 'relative', maxWidth: '400px' }}>
          <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Brand</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder=""
            style={{ width: '100%', boxSizing: 'border-box', height: '44px', border: `1px solid ${brand ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
          />
        </div>

        {/* Category + Size */}
        <div style={{ marginTop: '28px', display: 'flex', gap: '16px', maxWidth: '400px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', height: '44px', border: `1px solid ${category ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: category ? 'var(--color-ink)' : 'var(--color-ink-soft)', background: 'var(--color-bg)', outline: 'none', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="" disabled />
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Size</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              style={{ width: '100%', height: '44px', border: `1px solid ${size ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: size ? 'var(--color-ink)' : 'var(--color-ink-soft)', background: 'var(--color-bg)', outline: 'none', appearance: 'none', cursor: 'pointer' }}
            >
              <option value="" disabled />
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginTop: '28px', maxWidth: '560px', position: 'relative' }}>
          <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            style={{ width: '100%', boxSizing: 'border-box', height: '44px', border: `1px solid ${title ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '0 12px', fontSize: '14px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
          />
          {title && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>{title.toUpperCase()}</div>
              <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-ink-soft)' }}>this is how buyers see it</div>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginTop: '28px', maxWidth: '560px', position: 'relative' }}>
          <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${description ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '12px 12px 28px', fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none', resize: 'vertical', minHeight: '120px' }}
          />
          <span style={{ position: 'absolute', right: '10px', bottom: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>{description.length} / 600</span>
        </div>
      </div>

      {/* ── STEP 3: CONDITION ── */}
      <div style={{ marginTop: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid var(--color-line)', paddingBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink-soft)' }}>03</span>
          <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Condition</span>
        </div>

        {/* Rubric */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '4px', maxWidth: '560px' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
            const active = conditionScore === score
            return (
              <button
                key={score}
                onClick={() => setConditionScore(score)}
                style={{
                  flex: 1,
                  height: '40px',
                  boxSizing: 'border-box',
                  border: `1px solid ${active ? 'var(--color-ink)' : 'var(--color-line)'}`,
                  borderRadius: '2px',
                  background: active ? 'var(--color-ink)' : 'var(--color-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: active ? 700 : 400,
                  fontSize: '12px',
                  color: active ? 'var(--color-bg)' : 'var(--color-ink-soft)',
                  cursor: 'pointer',
                  transition: 'all 120ms linear',
                }}
                aria-pressed={active}
                aria-label={`Condition ${score}`}
              >
                {score}
              </button>
            )
          })}
        </div>

        {conditionScore && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-ink)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }}>{conditionScore}</span>
            {' '}— {CONDITION_DEFINITIONS[conditionScore]}
          </div>
        )}

        {/* Damage checklist */}
        <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '560px' }}>
          {DAMAGE_FLAGS.map((flag) => {
            const checked = damageFlags.includes(flag)
            const label   = flag.charAt(0).toUpperCase() + flag.slice(1)
            return (
              <div key={flag}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}
                  onClick={() => toggleFlag(flag)}
                >
                  <span style={{
                    width: '16px', height: '16px', flexShrink: 0, boxSizing: 'border-box',
                    border: '1px solid var(--color-ink)', borderRadius: '2px',
                    background: checked ? 'var(--color-ink)' : 'var(--color-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', lineHeight: 1, color: 'var(--color-bg)',
                  }}>
                    {checked ? '✓' : ''}
                  </span>
                  <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>{label}</span>
                </div>
                {checked && (
                  <div style={{ margin: '4px 0 8px 26px' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Note — required</label>
                      <input
                        type="text"
                        value={damageNotes[flag]}
                        onChange={(e) => setDamageNotes((n) => ({ ...n, [flag]: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', height: '44px', border: '1px solid var(--color-line)', borderRadius: '2px', padding: '0 12px', fontSize: '13px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEP 4: PRICE ── */}
      <div style={{ marginTop: '80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid var(--color-line)', paddingBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink-soft)' }}>04</span>
          <span style={{ font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>Price</span>
        </div>

        <div style={{ marginTop: '28px', maxWidth: '280px', position: 'relative' }}>
          <label style={{ position: 'absolute', left: '6px', top: '-7px', background: 'var(--color-bg)', padding: '0 4px', font: '500 12px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', zIndex: 1 }}>Asking price</label>
          <input
            type="text"
            inputMode="decimal"
            value={priceRaw}
            onChange={(e) => setPriceRaw(e.target.value)}
            placeholder="0"
            style={{ width: '100%', boxSizing: 'border-box', height: '64px', border: `1px solid ${priceCents > 0 ? 'var(--color-ink)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '0 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '28px', color: 'var(--color-ink)', background: 'var(--color-bg)', outline: 'none' }}
          />
          {priceCents > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              you receive {formatCents(payoutAmount)} — seller fee 2% ({formatCents(feeAmount)})
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ marginTop: '48px', maxWidth: '560px' }}>
          {submitError && (
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--color-alert)' }}>{submitError}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', width: '100%', boxSizing: 'border-box', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: '2px', font: '500 14px var(--font-ui)', letterSpacing: '-0.01em', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, transition: 'opacity 120ms linear' }}
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-soft)', textAlign: 'center' }}>
            every listing is reviewed before going live — usually under 24h.
          </div>
        </div>
      </div>
    </div>
  )
}
