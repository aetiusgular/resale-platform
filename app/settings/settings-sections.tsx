'use client'

/**
 * Settings sections (design 2A–2E + Orders / Review). Pure presentation + the
 * small mutations each section owns:
 *   profile  → PATCH /api/settings/profile (username 1×/30d, display name, avatar)
 *   sizes    → PUT /api/settings/sizes ({ sizes, hide_not_my_size })
 *   prefs    → PUT /api/notifications/prefs
 *   address  → /api/settings/addresses (+ /[id] PATCH / DELETE)
 *   review   → POST /api/reviews (tags + photos)
 *   delete   → POST /api/account/delete
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import PrefetchLink from '@/app/components/prefetch-link'
import { CheckIcon } from '@/app/components/icons'
import { ThemeSegment } from '@/app/components/theme'
import PushSubscribe from '@/app/components/push-subscribe'
import { createClient } from '@/lib/supabase/browser'
import { SETTINGS_SIZE_GROUPS, SIZE_DEPTS, countSizes, sizeKey, sizesChipLabel, type SizeDept, type UserSizes } from '@/lib/sizes'
import { PREF_ROWS } from '@/lib/notify/prefs'
import type { NotificationPrefs } from '@/lib/notify/types'
import { FEE_TIERS, formatCents } from '@/lib/fees'
import { RATE_WORDS, REVIEW_MAX_BODY, REVIEW_MAX_PHOTOS, REVIEW_TAGS } from '@/lib/reviews/tags'
import { STATE_LABELS, type OrderState } from '@/lib/orders'
import PhoneVerify from './phone-verify'
import TierDashboard from './tier-dashboard'
import SignOutLink from './sign-out-link'

/** `profile` = the hub's profile form on its own route (mobile web reaches it from the 09 menu). */
export type SettingsSection = 'hub' | 'profile' | 'orders' | 'review' | 'address' | 'sizes' | 'notifications' | 'payouts' | 'phone' | 'tiers'

export type { SettingsAddress, SettingsOrderRow, ReviewTarget, SettingsData } from '@/lib/loaders/settings'
import type { SettingsAddress, SettingsOrderRow, SettingsData } from '@/lib/loaders/settings'

function SectionHead({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="sec-head">
      <span className="sec-head__label">{label}</span>
      {right}
    </div>
  )
}

/**
 * "SETTINGS / ORDERS" on desktop. ≤720px (mobile-web 10–13) it becomes the section's back
 * row under the web header: "←" to the parent, the section title, and `meta` on the right
 * ("2 SAVED", "7 SELECTED", ACTIVE). `mobile="link"` renders the lighter "← BACK TO ORDERS"
 * text link instead (16 · Leave a review).
 */
function Crumb({ trail, meta, mobile = 'bar', title }: {
  trail: Array<{ label: string; href?: string }>
  meta?: ReactNode
  mobile?: 'bar' | 'link'
  /** Mobile bar title when it differs from the trail label ("SHIPPING ADDRESS" vs ADDRESS). */
  title?: string
}) {
  const parent = trail.length > 1 && trail[trail.length - 2].href ? trail[trail.length - 2] : { label: 'SETTINGS', href: '/settings' }
  const current = trail[trail.length - 1]
  return (
    <div className={`crumb crumb--${mobile}`}>
      <span className="crumb__trail">
        <PrefetchLink href="/settings">SETTINGS</PrefetchLink>
        {trail.map((t) => (
          <span key={t.label}> / {t.href ? <PrefetchLink href={t.href}>{t.label}</PrefetchLink> : t.label}</span>
        ))}
      </span>
      {mobile === 'bar' ? (
        <span className="crumb__bar">
          <PrefetchLink href={parent.href as string} className="crumb__back" aria-label={`Back to ${parent.label.toLowerCase()}`} data-testid="settings-back">←</PrefetchLink>
          <span className="crumb__title">{title ?? current.label}</span>
          <span className="spacer" />
          {meta && <span className="crumb__meta">{meta}</span>}
        </span>
      ) : (
        <PrefetchLink href={parent.href as string} className="crumb__backlink" data-testid="settings-back">← BACK TO {parent.label}</PrefetchLink>
      )}
    </div>
  )
}

/** Button label flips to a confirmation for a beat after saving. */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  return [on, () => { setOn(true); window.setTimeout(() => setOn(false), 1400) }]
}

const pct = (bps: number) => (bps / 100).toFixed(1) + '%'
/** Deterministic (UTC, fixed locale) so SSR and hydration agree. */
const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'UTC' })
const TIER_NAMES = ['New seller', 'Established seller', 'Power seller', 'Elite seller']

// ─── Hub ─────────────────────────────────────────────────────────────────────
function HubSection({ data, asProfile = false }: { data: SettingsData; asProfile?: boolean }) {
  const router = useRouter()
  const [username, setUsername] = useState(`@${data.username}`)
  const [displayName, setDisplayName] = useState(data.displayName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(data.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flash] = useFlash()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = (data.displayName || data.username).slice(0, 2).toUpperCase()
  const dirty = username.replace(/^@/, '') !== data.username || displayName !== (data.displayName ?? '')
  const windowOpen = data.usernameWindowOpen

  async function save() {
    if (!dirty || saving) return
    setSaving(true); setError('')
    const body: Record<string, string> = {}
    if (username.replace(/^@/, '') !== data.username) body.username = username
    if (displayName !== (data.displayName ?? '')) body.display_name = displayName
    const res = await fetch('/api/settings/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) { flash(); router.refresh() }
    else {
      const d = await res.json().catch(() => ({}))
      setError((d.error ?? 'Could not save.').toUpperCase())
    }
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return
    setError('')
    const supabase = createClient()
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `avatars/${data.userId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (upErr) { setError('UPLOAD FAILED — TRY A JPG OR PNG UNDER 5MB'); return }
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    const res = await fetch('/api/settings/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: pub.publicUrl }) })
    if (res.ok) { setAvatarUrl(pub.publicUrl); router.refresh() } else setError('COULD NOT SAVE PHOTO')
  }

  async function removePhoto() {
    const res = await fetch('/api/settings/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: null }) })
    if (res.ok) { setAvatarUrl(null); router.refresh() }
  }

  async function deleteAccount() {
    if (deleteWord !== 'DELETE' || deleting) return
    setDeleting(true); setError('')
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) })
    if (res.ok) { router.push('/enter'); router.refresh(); return }
    const d = await res.json().catch(() => ({}))
    setDeleting(false)
    setError((d.code === 'open_orders' ? 'Finish or cancel your open orders before deleting the account.' : d.error ?? 'Could not delete the account.').toUpperCase())
  }

  const t = data.sellerTier
  const tierIdx = FEE_TIERS.findIndex((x) => x.bps === t.current.bps) // 0 = best
  const tierNumber = FEE_TIERS.length - tierIdx // base → 1
  const onRamp = data.welcomeLeft > 0
  const orderFrac = t.next ? Math.min(1, t.orderCount / Math.max(1, t.next.minOrders)) : 1

  return (
    <div className="settings-body">
      {asProfile && <Crumb trail={[{ label: 'PROFILE' }]} />}
      <div className="page-head">
        <h1 className="page-title">{asProfile ? 'Profile' : 'Settings'}</h1>
        <span className="page-note">{data.memberSince ? `MEMBER SINCE ${data.memberSince}` : 'MEMBER'} · TIER {tierNumber}</span>
      </div>

      <SectionHead label="01 — PROFILE" right={<PrefetchLink className="link-underline" href={`/sellers/${data.username}`}>VIEW PUBLIC PROFILE →</PrefetchLink>} />
      <div className="profile-row">
        <span className="profile-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>{initials}</span>
        <div className="profile-avatar__actions">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void changePhoto(e.target.files?.[0])} />
          <button type="button" className="link-underline link-underline--ink" onClick={() => fileRef.current?.click()}>CHANGE PHOTO</button>
          <button type="button" className="link-underline" onClick={() => void removePhoto()} disabled={!avatarUrl}>REMOVE</button>
        </div>
      </div>
      <div className="field-grid">
        <div>
          <div className="field-label">USERNAME</div>
          <input className="input-sans" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username" data-testid="username-input" />
        </div>
        <div>
          <div className="field-label">DISPLAY NAME</div>
          <input className="input-sans" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="Shown on your profile" aria-label="Display name" />
        </div>
      </div>
      <div className="field-block">
        <div className="field-label field-label--row">
          <span>EMAIL</span>
          <span className="tag">{data.emailVerified ? 'VERIFIED' : 'UNVERIFIED'}</span>
        </div>
        <input className="input-sans" value={data.email} readOnly aria-label="Email" title="Email changes go through support during the alpha" />
      </div>
      {error && <div className="alert-line" role="alert">{error}</div>}
      <div className="save-row">
        <button type="button" className="btn-primary btn-primary--inline" onClick={save} disabled={!dirty || saving} data-testid="profile-save">
          {saving ? 'SAVING…' : savedFlash ? 'SAVED ✓' : 'SAVE CHANGES'}
        </button>
        <span className="page-note">{windowOpen ? 'USERNAME CAN CHANGE 1× / 30 DAYS' : `USERNAME CHANGES AGAIN ${shortDate(data.usernameNextChangeAt as number)}`}</span>
      </div>

      <SectionHead label="02 — PHONE" right={<span className="page-note">{data.phoneVerificationEnabled ? 'REQUIRED TO SELL' : 'ARRIVES AT LAUNCH'}</span>} />
      {data.phoneVerificationEnabled ? (
        <PhoneVerify verified={data.phoneVerified} initialPhone={data.phone} compact />
      ) : (
        <div className="phone-row">
          <span className="phone-num">{data.phone ? maskPhone(data.phone) : '— — —'}</span>
          <span className="tag">{data.phoneVerified ? 'VERIFIED' : 'UNVERIFIED'}</span>
          <span className="spacer" />
          <span className="soon-tag">SOON</span>
        </div>
      )}
      <div className="settings-note">Used for order and delivery alerts only — never shown publicly.</div>

      <SectionHead label="03 — SELLER TIER" right={<PrefetchLink className="link-underline" href="/fees">VIEW FEE SCHEDULE →</PrefetchLink>} />
      <div className="tier-row">
        <div>
          <div className="tier-name">Tier {tierNumber}</div>
          <div className="tier-sub">{onRamp ? 'WELCOME RAMP' : TIER_NAMES[Math.max(0, Math.min(TIER_NAMES.length - 1, tierNumber - 1))].toUpperCase()}</div>
        </div>
        <div className="tier-stats">
          <div><div className="field-label">CURRENT FEE</div><div className="tier-stat">{onRamp ? '0.0%' : pct(t.effectiveBps)}</div></div>
          {t.next && <div><div className="field-label">TIER {tierNumber + 1} FEE</div><div className="tier-stat">{pct(t.next.bps)}</div></div>}
          <div><div className="field-label">{t.locked && t.lockedUntilMs ? 'LOCKED UNTIL' : 'REVIEW DATE'}</div><div className="tier-stat">{shortDate(t.locked && t.lockedUntilMs ? t.lockedUntilMs : data.tierReviewDateMs)}</div></div>
        </div>
      </div>
      {onRamp ? (
        <>
          <div className="tier-bar"><div className="tier-bar__fill" style={{ width: `${Math.min(100, (data.salesCount / (data.salesCount + data.welcomeLeft)) * 100)}%` }} /></div>
          <div className="tier-bar__legend">
            <span>{data.salesCount} / {data.salesCount + data.welcomeLeft} WELCOME SALES</span>
            <span className="page-note">{data.welcomeLeft} FREE {data.welcomeLeft === 1 ? 'SALE' : 'SALES'} LEFT · THEN {pct(t.effectiveBps)}</span>
          </div>
        </>
      ) : t.next ? (
        <>
          <div className="tier-bar"><div className="tier-bar__fill" style={{ width: `${orderFrac * 100}%` }} /></div>
          <div className="tier-bar__legend">
            <span>{t.orderCount} / {t.next.minOrders} QUALIFYING SALES</span>
            <span className="page-note">{t.ordersToNext > 0 ? `${t.ordersToNext} MORE TO TIER ${tierNumber + 1}` : t.volumeToNextCents > 0 ? `${formatCents(t.volumeToNextCents)} MORE VOLUME TO TIER ${tierNumber + 1}` : `TIER ${tierNumber + 1} REACHED`}</span>
          </div>
        </>
      ) : (
        <>
          <div className="tier-bar"><div className="tier-bar__fill" style={{ width: '100%' }} /></div>
          <div className="tier-bar__legend">
            <span>BEST RATE — {pct(t.current.bps)}</span>
            <span className="page-note">MAINTAIN YOUR ACTIVITY TO KEEP IT</span>
          </div>
        </>
      )}

      <SectionHead label="04 — APPEARANCE" />
      <div className="appearance-row">
        <div>
          <div className="appearance-row__title">Theme</div>
          <div className="settings-note">Applies to this device.</div>
        </div>
        <ThemeSegment options={['light', 'dark', 'system']} />
      </div>

      <div className="danger-row">
        <SignOutLink className="btn-ghost btn-ghost--inline" label="SIGN OUT" />
        <span className="settings-note">Signed in as @{data.username}.</span>
        <span className="spacer" />
        <button type="button" className="link-underline link-underline--sm" onClick={() => setDeleteOpen((v) => !v)} data-testid="delete-account">DELETE ACCOUNT…</button>
      </div>
      {deleteOpen && (
        <div className="push-banner" style={{ borderColor: 'var(--alert)', flexWrap: 'wrap' }}>
          <span>This removes your profile, listings and saved items. Orders stay in the ledger. Type DELETE to confirm.</span>
          <span className="row" style={{ gap: 10 }}>
            <input className="input-mono" style={{ width: 120 }} value={deleteWord} onChange={(e) => setDeleteWord(e.target.value.toUpperCase())} placeholder="DELETE" aria-label="Type DELETE to confirm" />
            <button type="button" className="btn-mini btn-mini--solid" onClick={() => void deleteAccount()} disabled={deleteWord !== 'DELETE' || deleting}>{deleting ? 'DELETING…' : 'DELETE ACCOUNT'}</button>
            <button type="button" className="btn-mini btn-mini--link" onClick={() => { setDeleteOpen(false); setDeleteWord('') }}>CANCEL</button>
          </span>
        </div>
      )}
    </div>
  )
}

function maskPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `+1 (${m[1]}) ••• ••${m[3].slice(2)}` : e164
}

// ─── Orders ──────────────────────────────────────────────────────────────────
const ACTIVE_STATES = new Set(['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed'])

function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase()
}

function orderAction(row: SettingsOrderRow, labels: boolean): { label: string; href: string } {
  const buyer = row.role === 'buyer'
  const view = { label: 'VIEW →', href: `/orders/${row.id}` }
  switch (row.state) {
    case 'paid_held': return buyer ? view : { label: 'CONFIRM & SHIP →', href: `/orders/${row.id}` }
    case 'seller_confirmed': return buyer ? view : { label: labels ? 'PRINT LABEL →' : 'ADD TRACKING →', href: `/orders/${row.id}` }
    case 'shipped': return buyer ? { label: 'MARK AS RECEIVED →', href: `/orders/${row.id}` } : (row.hasTracking ? { label: 'TRACK →', href: `/orders/${row.id}` } : view)
    case 'delivered': return buyer ? { label: 'CONFIRM DELIVERY →', href: `/orders/${row.id}` } : view
    case 'released': return row.canReview ? { label: 'LEAVE FEEDBACK →', href: `/settings/review?order=${row.id}` } : view
    case 'disputed': return { label: 'VIEW DISPUTE →', href: `/orders/${row.id}` }
    default: return view
  }
}

function orderTag(state: string): { label: string; solid: boolean; alert?: boolean } {
  const label = (STATE_LABELS[state as OrderState] ?? state.toUpperCase())
    .replace('PAID & HELD', 'ESCROW HOLD').replace('SHIPPED', 'IN TRANSIT').replace('FUNDS RELEASED', 'DELIVERED')
  if (state === 'disputed') return { label, solid: false, alert: true }
  return { label, solid: state === 'shipped' || state === 'paid_held' || state === 'seller_confirmed' }
}

function OrdersSection({ data }: { data: SettingsData }) {
  const [tab, setTab] = useState<'ALL' | 'BUYING' | 'SELLING'>('ALL')
  const rows = data.orders
  const list = rows.filter((o) => tab === 'ALL' || (tab === 'BUYING' ? o.role === 'buyer' : o.role === 'seller'))
  const active = rows.filter((o) => ACTIVE_STATES.has(o.state)).length
  const count = (t: 'ALL' | 'BUYING' | 'SELLING') => (t === 'ALL' ? rows.length : rows.filter((o) => (t === 'BUYING' ? o.role === 'buyer' : o.role === 'seller')).length)

  return (
    <div className="settings-body">
      <Crumb trail={[{ label: 'ORDERS' }]} meta={`${active} ACTIVE`} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Orders</h1>
        <span className="page-note">{active} ACTIVE · {rows.length - active} COMPLETED</span>
      </div>
      <div className="tabs-line tabs-line--tight" role="tablist">
        {(['ALL', 'BUYING', 'SELLING'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tab-mono${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
            {t} ({count(t)})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <div className="empty__title">{tab === 'SELLING' ? 'No sales yet.' : tab === 'BUYING' ? 'No purchases yet.' : 'No orders yet.'}</div>
          <div className="empty__sub">{tab === 'SELLING' ? 'LIST SOMETHING — EVERY SALE IS HELD IN ESCROW' : 'EVERYTHING YOU BUY LANDS HERE WITH TRACKING AND ESCROW STATUS'}</div>
          <div className="empty__cta">
            <PrefetchLink href={tab === 'SELLING' ? '/sell/new' : '/browse'} className="btn-ghost btn-ghost--inline">{tab === 'SELLING' ? 'NEW LISTING →' : 'BROWSE →'}</PrefetchLink>
          </div>
        </div>
      ) : (
        list.map((o, i) => {
          const t = orderTag(o.state)
          const a = orderAction(o, data.shippingLabelsEnabled)
          const cancelled = o.state === 'cancelled' || o.state === 'refunded'
          return (
            <div key={o.id} className={`order-row${cancelled ? ' is-cancelled' : ''}`} data-testid="order-row">
              <span className="order-row__thumb" style={{ background: `var(--tone-${(i % 8) + 1})`, overflow: 'hidden' }}>
                {o.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </span>
              <div className="order-row__main">
                <div className="order-row__toprow">
                  <span className="order-row__brand">{o.brand.toUpperCase() || '—'}</span>
                  <span className="tag">{o.role === 'buyer' ? 'BUYING' : 'SELLING'}</span>
                </div>
                <div className="order-row__title">{o.title}</div>
                <div className="order-row__meta">ORDER #{o.id.slice(0, 8).toUpperCase()} · {orderDate(o.created_at)}{o.size ? ` · SIZE ${o.size.toUpperCase()}` : ''}</div>
              </div>
              <span className="order-row__price">{o.amount}</span>
              <span className={`tag${t.solid ? ' tag--ink' : ''}${t.alert ? ' tag--alert' : ''}`}>{t.label}</span>
              <PrefetchLink className="link-underline link-underline--ink" href={a.href}>{a.label}</PrefetchLink>
            </div>
          )
        })
      )}
      <div className="rows-note">ESCROW RELEASES WHEN THE BUYER CONFIRMS DELIVERY.</div>
    </div>
  )
}

// ─── Review ──────────────────────────────────────────────────────────────────
function ReviewSection({ data }: { data: SettingsData }) {
  const router = useRouter()
  const r = data.review
  const [rating, setRating] = useState(5)
  const [tags, setTags] = useState<Set<string>>(() => new Set())
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentFlash, flash] = useFlash()
  const fileRef = useRef<HTMLInputElement>(null)

  if (!r) {
    return (
      <div className="settings-body">
        <Crumb trail={[{ label: 'ORDERS', href: '/settings/orders' }, { label: 'REVIEW' }]} mobile="link" />
        <div className="empty"><div className="empty__title">Pick an order to review.</div><div className="empty__cta"><PrefetchLink href="/settings/orders" className="link-underline link-underline--ink">ORDERS →</PrefetchLink></div></div>
      </div>
    )
  }

  const toggleTag = (t: string) => setTags((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })

  async function addPhoto(file: File | undefined) {
    if (!file || photos.length >= REVIEW_MAX_PHOTOS || !r) return
    setError('')
    const supabase = createClient()
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `listings/${data.userId}/reviews/${r.orderId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type || 'image/jpeg' })
    if (upErr) { setError('UPLOAD FAILED — TRY A JPG OR PNG'); return }
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    setPhotos((p) => [...p, pub.publicUrl])
  }

  async function submit() {
    if (!r || busy) return
    setBusy(true); setError('')
    const res = await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: r.orderId, stars: rating, body: text, tags: Array.from(tags), photos }),
    })
    setBusy(false)
    if (res.ok) {
      flash()
      window.setTimeout(() => { router.push('/settings/orders'); router.refresh() }, 1200)
      return
    }
    const d = await res.json().catch(() => ({}))
    setError((d.error === 'already_reviewed' ? 'You already reviewed this order.' : d.error ?? 'Could not post the review.').toUpperCase())
  }

  const sellerUpper = `@${r.sellerUsername.toUpperCase()}`

  return (
    <div className="settings-body">
      <Crumb trail={[{ label: 'ORDERS', href: '/settings/orders' }, { label: 'REVIEW' }]} mobile="link" />
      <div className="page-head page-head--ruled page-head--keep">
        <h1 className="page-title">Leave a review</h1>
        <span className="page-note">PUBLIC ON THE SELLER PROFILE</span>
      </div>
      <div className="review-item">
        <span className="review-item__thumb" style={{ background: 'var(--tone-1)', overflow: 'hidden' }}>
          {r.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </span>
        <div className="review-item__main">
          <div className="review-item__row">
            <span className="review-item__brand">{r.brand.toUpperCase()}</span>
            <span className="review-item__title">{r.title}</span>
          </div>
          <div className="review-item__meta">ORDER #{r.orderId.slice(0, 8).toUpperCase()} · DELIVERED {orderDate(r.deliveredAt)} · SOLD BY {sellerUpper}</div>
        </div>
        <span className="review-item__price">{r.amount}</span>
      </div>
      {!r.eligible && (
        <div className="alert-line" role="alert">
          {r.reason === 'already_reviewed' ? 'YOU ALREADY REVIEWED THIS ORDER.' : r.reason === 'order_not_completed' ? 'REVIEWS OPEN ONCE THE ORDER COMPLETES.' : !data.reviewsEnabled ? 'REVIEWS ARRIVE AT LAUNCH.' : 'THIS ORDER CAN’T BE REVIEWED.'}
        </div>
      )}
      <div className="review-label">RATING</div>
      <div className="rate-row">
        <span className="rate-cells">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`rate-cell${n <= rating ? ' is-on' : ''}`} aria-pressed={n === rating} aria-label={`Rate ${n} of 5`} onClick={() => setRating(n)}>
              {n}
            </button>
          ))}
        </span>
        <span className="rate-word">{rating} / 5 — {RATE_WORDS[rating - 1]}</span>
      </div>
      <div className="review-label">WHAT STOOD OUT <em>— OPTIONAL</em></div>
      <div className="review-tags">
        {REVIEW_TAGS.map((t) => {
          const on = tags.has(t)
          return (
            <button key={t} type="button" className={`chip${on ? ' chip--solid' : ''}`} aria-pressed={on} onClick={() => toggleTag(t)}>
              {t}{on ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
      <div className="review-label">YOUR REVIEW</div>
      <textarea
        className="review-text"
        maxLength={REVIEW_MAX_BODY}
        placeholder="How was the item and the sale? Condition, packaging, timing —"
        aria-label="Your review"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="review-count"><span>EDITABLE FOR 48 HOURS AFTER POSTING</span><span>{text.length} / {REVIEW_MAX_BODY}</span></div>
      <div className="review-label">ADD PHOTOS <em>— OPTIONAL</em></div>
      <div className="photo-row">
        {photos.map((p, i) => (
          <span key={p} className="photo-slot" style={{ background: `var(--tone-${(i % 8) + 2})`, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </span>
        ))}
        {photos.length < REVIEW_MAX_PHOTOS && (
          <>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void addPhoto(e.target.files?.[0])} />
            <button type="button" className="photo-add" aria-label="Add photo" onClick={() => fileRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </>
        )}
        <span className="photo-note">{photos.length} OF {REVIEW_MAX_PHOTOS} · JPG / PNG</span>
      </div>
      {error && <div className="alert-line" role="alert">{error}</div>}
      <div className="save-row save-row--left save-row--flow">
        <button type="button" className="btn-primary btn-primary--inline" onClick={() => void submit()} disabled={!r.eligible || busy} data-testid="review-submit">
          {busy ? 'POSTING…' : sentFlash ? 'SUBMITTED ✓' : 'SUBMIT REVIEW →'}
        </button>
        <span className="page-note">REVIEWS POST TO {sellerUpper}&rsquo;S PROFILE</span>
      </div>
    </div>
  )
}

// ─── Address ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', street: '', unit: '', city: '', state: '', zip: '' }

function AddressSection({ data }: { data: SettingsData }) {
  const router = useRouter()
  const [addresses, setAddresses] = useState(data.addresses)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [asDefault, setAsDefault] = useState(data.addresses.length === 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flash] = useFlash()
  const patch = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim() || !form.street.trim() || !form.city.trim() || saving) return
    setSaving(true); setError('')
    const address = { name: form.name, street1: form.street, street2: form.unit, city: form.city, state: form.state, zip: form.zip }
    const res = editingId
      ? await fetch(`/api/settings/addresses/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, is_default: asDefault || undefined }) })
      : await fetch('/api/settings/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, is_default: asDefault }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError((d.error ?? 'Could not save the address.').toUpperCase()); return }
    const saved = d.address as SettingsAddress
    setAddresses((xs) => {
      const cleared = saved.is_default ? xs.map((a) => ({ ...a, is_default: false })) : xs
      return editingId ? cleared.map((a) => (a.id === saved.id ? saved : a)) : [...cleared, saved]
    })
    setForm(EMPTY_FORM); setEditingId(null); setAsDefault(false)
    flash(); router.refresh()
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/settings/addresses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
    if (res.ok) { setAddresses((xs) => xs.map((a) => ({ ...a, is_default: a.id === id }))); router.refresh() }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/settings/addresses/${id}`, { method: 'DELETE' })
    if (res.ok) { setAddresses((xs) => xs.filter((a) => a.id !== id)); router.refresh() }
  }

  function edit(a: SettingsAddress) {
    setEditingId(a.id)
    setAsDefault(a.is_default)
    setForm({ name: a.name, street: a.street1, unit: a.street2 ?? '', city: a.city, state: a.state, zip: a.zip })
    document.getElementById('addr-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="settings-body">
      <Crumb trail={[{ label: 'ADDRESS' }]} title="SHIPPING ADDRESS" meta={addresses.length ? `${addresses.length} SAVED` : undefined} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Shipping address</h1>
        <span className="page-note">USED FOR PREPAID LABELS AND RETURNS</span>
      </div>
      {addresses.length > 0 ? (
        <div className="addr-grid">
          {addresses.map((a) => (
            <div key={a.id} className={`addr-card${a.is_default ? ' is-default' : ''}`} data-testid="address-card">
              <div className="addr-card__head">
                <span className="addr-card__name">{a.name}</span>
                {a.is_default ? (
                  <span className="tag tag--ink">DEFAULT</span>
                ) : (
                  <button type="button" className="link-underline" onClick={() => void setDefault(a.id)}>SET DEFAULT</button>
                )}
              </div>
              <div className="addr-card__lines">
                <div>{[a.street1, a.street2].filter(Boolean).join(', ')}</div>
                <div>{a.city}, {a.state} {a.zip}</div>
                <div>United States</div>
              </div>
              <div className="addr-card__foot">
                <button type="button" className="link-underline link-underline--ink" onClick={() => edit(a)}>EDIT</button>
                <button type="button" className="link-underline" onClick={() => void remove(a.id)}>REMOVE</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="settings-note" style={{ paddingTop: 18 }}>No address yet — add one below. The default pre-fills checkout and prints on prepaid labels.</div>
      )}

      <div id="addr-form">
        <SectionHead label={editingId ? 'EDIT ADDRESS' : 'ADD NEW ADDRESS'} right={editingId ? <button type="button" className="link-underline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>CANCEL</button> : undefined} />
      </div>
      <div className="field-block">
        <div className="field-label">FULL NAME</div>
        <input className="input-sans" placeholder="Name on shipping label" value={form.name} onChange={patch('name')} aria-label="Full name" autoComplete="name" />
      </div>
      <div className="field-grid field-grid--2-1">
        <div>
          <div className="field-label">STREET ADDRESS</div>
          <input className="input-sans" placeholder="Street and number" value={form.street} onChange={patch('street')} aria-label="Street address" autoComplete="address-line1" />
        </div>
        <div>
          <div className="field-label">APT / UNIT</div>
          <input className="input-sans" placeholder="Optional" value={form.unit} onChange={patch('unit')} aria-label="Apartment or unit" autoComplete="address-line2" />
        </div>
      </div>
      <div className="field-grid field-grid--2-1-1">
        <div>
          <div className="field-label">CITY</div>
          <input className="input-sans" value={form.city} onChange={patch('city')} aria-label="City" autoComplete="address-level2" />
        </div>
        <div>
          <div className="field-label">STATE</div>
          <input className="input-sans" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} aria-label="State" autoComplete="address-level1" />
        </div>
        <div>
          <div className="field-label">ZIP</div>
          <input className="input-sans" value={form.zip} onChange={patch('zip')} aria-label="ZIP code" autoComplete="postal-code" inputMode="numeric" />
        </div>
      </div>
      {error && <div className="alert-line" role="alert">{error}</div>}
      <div className="save-row save-row--left">
        <button type="button" className="btn-primary btn-primary--inline" onClick={() => void save()} disabled={saving} data-testid="address-save">
          {saving ? 'SAVING…' : savedFlash ? 'SAVED ✓' : 'SAVE ADDRESS'}
        </button>
        <button type="button" className="check-inline" aria-pressed={asDefault} onClick={() => setAsDefault((v) => !v)}>
          <span className={`checkbox${asDefault ? ' is-on' : ''}`}>{asDefault && <CheckIcon size={8} />}</span>
          <span>Set as default</span>
        </button>
      </div>
    </div>
  )
}

// ─── Sizes ───────────────────────────────────────────────────────────────────
function SizesSection({ data }: { data: SettingsData }) {
  const router = useRouter()
  const [dept, setDept] = useState<SizeDept>('menswear')
  const [sizes, setSizes] = useState<UserSizes>(() => ({ ...data.sizes }))
  const [hideOn, setHideOn] = useState(data.hideNotMySize)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flash] = useFlash()
  const isDirty = useMemo(() => JSON.stringify(sizes) !== JSON.stringify(data.sizes) || hideOn !== data.hideNotMySize, [sizes, data.sizes, hideOn, data.hideNotMySize])
  const count = countSizes(sizes)

  const toggle = (key: string, size: string) =>
    setSizes((s) => {
      const cur = s[key] ?? []
      return { ...s, [key]: cur.includes(size) ? cur.filter((x) => x !== size) : [...cur, size] }
    })

  async function save() {
    if (!isDirty || saving) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/settings/sizes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizes, hide_not_my_size: hideOn }),
    })
    setSaving(false)
    if (res.ok) { flash(); router.refresh() } else setError('COULD NOT SAVE — TRY AGAIN')
  }

  // Reference groups plus any extra sizes already saved for that section.
  const groups = SETTINGS_SIZE_GROUPS[dept].map((g) => {
    const key = sizeKey(dept, g.id)
    const extra = (sizes[key] ?? []).filter((s) => !g.scale.includes(s))
    return { ...g, key, scale: [...g.scale, ...extra] }
  })

  return (
    <div className="settings-body settings-body--dock">
      <Crumb trail={[{ label: 'MY SIZES' }]} meta={`${count} SELECTED`} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">My sizes</h1>
        <span className="page-note">POWERS THE MY-SIZES FILTER IN BROWSE</span>
      </div>
      <button type="button" className="switch-row" aria-pressed={hideOn} onClick={() => setHideOn((v) => !v)} data-testid="hide-not-my-size">
        <span className="switch-row__label">Hide listings that aren&rsquo;t my size</span>
        <span className="switch-row__state">{hideOn ? 'ON' : 'OFF'}</span>
        <span className={`switch${hideOn ? ' is-on' : ''}`}><span className="switch__knob" /></span>
      </button>
      <div className="tabs-line tabs-line--tight" role="tablist">
        {SIZE_DEPTS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dept === d} className={`tab-mono${dept === d ? ' is-active' : ''}`} onClick={() => setDept(d)}>{d.toUpperCase()}</button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="chip-grid__label">{g.label}</div>
          <div className="chip-grid" style={{ '--cols': g.cols } as React.CSSProperties}>
            {g.scale.map((s) => {
              const on = (sizes[g.key] ?? []).includes(s)
              return (
                <button key={s} type="button" className={`size-cell${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(g.key, s)}>
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {error && <div className="alert-line" role="alert">{error}</div>}
      <div className="save-row save-row--dock">
        <button type="button" className="btn-primary btn-primary--inline" onClick={save} disabled={!isDirty || saving} data-testid="sizes-save-btn">
          {saving ? 'SAVING…' : savedFlash ? 'SAVED ✓' : 'SAVE MY SIZES'}
        </button>
        <span className="page-note">{count} {count === 1 ? 'SIZE' : 'SIZES'} SELECTED</span>
      </div>
    </div>
  )
}

// ─── Notifications ───────────────────────────────────────────────────────────
function NotificationsSection({ data }: { data: SettingsData }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(data.prefs)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flash] = useFlash()
  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(data.prefs), [prefs, data.prefs])
  const enabled = data.notificationsEnabled

  const toggle = (k: keyof NotificationPrefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }))
  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/notifications/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) })
    setSaving(false)
    if (res.ok) flash(); else setError('COULD NOT SAVE — TRY AGAIN')
  }

  return (
    <div className="settings-body settings-body--dock">
      <Crumb trail={[{ label: 'NOTIFICATIONS' }]} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Notifications</h1>
        <span className="page-note">{enabled ? 'PER-CHANNEL, PER-EVENT' : 'EMAIL + PUSH ARRIVE AT LAUNCH'}</span>
      </div>
      <div className="notif-cols">
        <span className="spacer" />
        <span className="notif-cols__h">EMAIL</span>
        <span className="notif-cols__h">PUSH</span>
      </div>
      {PREF_ROWS.map((c) => {
        const ek = `email_${c.id}` as keyof NotificationPrefs
        const pk = `push_${c.id}` as keyof NotificationPrefs
        return (
          <div key={c.id} className="pref-row">
            <span className="pref-row__label">{c.label}</span>
            <button type="button" className="pref-row__cell" aria-pressed={prefs[ek]} aria-label={`${c.label} — email`} onClick={() => toggle(ek)} disabled={!enabled}>
              <span className={`checkbox${prefs[ek] ? ' is-on' : ''}`}>{prefs[ek] && <CheckIcon size={8} />}</span>
            </button>
            <button type="button" className="pref-row__cell" aria-pressed={prefs[pk]} aria-label={`${c.label} — push`} onClick={() => toggle(pk)} disabled={!enabled}>
              <span className={`checkbox${prefs[pk] ? ' is-on' : ''}`}>{prefs[pk] && <CheckIcon size={8} />}</span>
            </button>
          </div>
        )
      })}
      {enabled ? <PushSubscribe /> : <div className="push-note">IN-APP NOTIFICATIONS ARE ALWAYS ON · EMAIL AND PUSH SWITCH ON AT LAUNCH</div>}
      <div className="push-note push-note--m">ORDER &amp; SECURITY EMAILS ALWAYS SEND.</div>
      {error && <div className="alert-line" role="alert">{error}</div>}
      <div className="save-row save-row--dock">
        <button type="button" className="btn-primary btn-primary--inline" onClick={save} disabled={!enabled || !dirty || saving}>
          {saving ? 'SAVING…' : savedFlash ? 'SAVED ✓' : 'SAVE PREFERENCES'}
        </button>
        <span className="page-note">ORDER &amp; SECURITY EMAILS ALWAYS SEND</span>
      </div>
    </div>
  )
}

// ─── Payouts ─────────────────────────────────────────────────────────────────
type Balance = {
  connected: boolean
  payoutsEnabled: boolean
  pendingEscrowCents: number
  paidOutAllTimeCents: number
  stripe: {
    availableCents: number
    pendingCents: number
    bank: { name: string | null; last4: string | null } | null
    payouts: Array<{ id: string; date: string; amountCents: number; status: string; description: string | null }>
  } | null
}

function PayoutsSection({ data }: { data: SettingsData }) {
  const [bal, setBal] = useState<Balance | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stripe/balance')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('balance'))))
      .then((d: Balance) => { if (!cancelled) setBal(d) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const bank = bal?.stripe?.bank
  const bankLine = data.payoutsEnabled
    ? bank ? `Payouts to ${(bank.name ?? 'BANK').toUpperCase()} •••• ${bank.last4 ?? '••••'} · arrives in 2 business days` : 'Payouts arrive in your Stripe balance 2 business days after release.'
    : 'Required before your listings can go live. Stripe holds your bank details — they never touch our servers.'
  const money = (c: number | undefined) => (typeof c === 'number' ? formatCents(c) : '—')
  const histDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'UTC' })

  return (
    <div className="settings-body settings-body--payouts">
      <Crumb trail={[{ label: 'PAYOUTS' }]} meta={<span className={`tag${data.payoutsEnabled ? ' tag--ink' : ''}`}>{data.payoutsEnabled ? 'ACTIVE' : 'NOT SET'}</span>} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Payouts</h1>
        <span className="page-note">POWERED BY STRIPE EXPRESS</span>
      </div>
      {data.payoutOnboardingDone && !data.payoutsEnabled && (
        <div className="push-banner">
          <span>Onboarding submitted — Stripe is reviewing your account. This page updates once payouts are enabled (usually minutes).</span>
        </div>
      )}
      <div className="payout-row">
        <span className="payout-row__name">Stripe Express</span>
        <span className={`tag${data.payoutsEnabled ? ' tag--ink' : ''}`}>{data.payoutsEnabled ? 'ACTIVE' : 'NOT CONNECTED'}</span>
        <span className="spacer" />
        <a href="/api/stripe/connect" className="btn-ghost btn-ghost--inline" data-testid="stripe-connect">
          {data.payoutsEnabled ? 'MANAGE IN STRIPE →' : 'CONNECT STRIPE →'}
        </a>
      </div>
      <div className="settings-note">{bankLine}</div>
      <div className="payout-stats">
        <div className="payout-stats__main"><div className="field-label">AVAILABLE</div><div className="payout-stat">{bal ? money(bal.stripe?.availableCents ?? 0) : failed ? '—' : '…'}</div></div>
        <div className="payout-stats__sub"><div className="field-label">PENDING ESCROW</div><div className="payout-stat payout-stat--dim">{bal ? money(bal.pendingEscrowCents) : failed ? '—' : '…'}</div></div>
        <div className="payout-stats__sub"><div className="field-label">PAID OUT — ALL TIME</div><div className="payout-stat payout-stat--dim">{bal ? money(bal.paidOutAllTimeCents) : failed ? '—' : '…'}</div></div>
      </div>
      <SectionHead label="HISTORY" right={<span className="page-note">LAST 90 DAYS</span>} />
      {bal?.stripe?.payouts?.length ? (
        bal.stripe.payouts.map((p) => {
          const paid = p.status === 'paid'
          return (
            <div key={p.id} className="hist-row">
              <span className="hist-row__date">{histDate(p.date)}</span>
              <span className="hist-row__label">{p.description ?? 'Payout to bank'}</span>
              <span className={`tag${paid ? ' tag--ink' : ''}`}>{paid ? 'PAID' : p.status === 'failed' || p.status === 'canceled' ? p.status.toUpperCase() : 'IN TRANSIT'}</span>
              <span className="hist-row__amt">{formatCents(p.amountCents)}</span>
            </div>
          )
        })
      ) : (
        <div className="mono-note" style={{ paddingTop: 12 }}>{bal || failed ? 'NO PAYOUTS IN THE LAST 90 DAYS' : 'LOADING…'}</div>
      )}
      <div className="save-row save-row--left">
        <PrefetchLink href="/settings/orders" className="link-underline link-underline--ink">VIEW SALES →</PrefetchLink>
        <PrefetchLink href="/fees" className="link-underline">FEE SCHEDULE</PrefetchLink>
      </div>
    </div>
  )
}

// ─── Phone / Tiers (flag-gated extras) ───────────────────────────────────────
function PhoneSection({ data }: { data: SettingsData }) {
  return (
    <div className="settings-body">
      <Crumb trail={[{ label: 'PHONE' }]} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Phone</h1>
        <span className="page-note">REQUIRED TO SELL · NEVER SHOWN PUBLICLY</span>
      </div>
      {data.phoneVerificationEnabled ? (
        <PhoneVerify verified={data.phoneVerified} initialPhone={data.phone} />
      ) : (
        <div className="empty"><div className="empty__title">Phone verification arrives at launch.</div></div>
      )}
    </div>
  )
}

function TiersSection({ data }: { data: SettingsData }) {
  return (
    <div className="settings-body">
      <Crumb trail={[{ label: 'FEES & TIERS' }]} />
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Fees &amp; tiers</h1>
        <span className="page-note">RATE SET BY YOUR LAST 12 MONTHS</span>
      </div>
      {data.tierDashboardEnabled ? (
        <TierDashboard buyer={data.buyerTier} seller={data.sellerTier} />
      ) : (
        <div className="empty"><div className="empty__title">Tier dashboard arrives at launch.</div><div className="empty__cta"><PrefetchLink href="/fees" className="link-underline link-underline--ink">FEE SCHEDULE →</PrefetchLink></div></div>
      )}
    </div>
  )
}

// ─── Mobile hub menu (mobile-web 09) ─────────────────────────────────────────
/**
 * ≤720px /settings is a menu: profile card, then ACCOUNT / PREFERENCES / SELLING rows
 * into the sections, THEME inline, Sign out · ALPHA 01 at the foot. Hidden on desktop
 * (the hub there is the 2A profile page — `HubSection`). Rendered by the shell.
 */
function MenuRow({ href, label, meta }: { href: string; label: string; meta?: string }) {
  return (
    <PrefetchLink href={href} className="menu-row">
      {label}
      <span className="menu-row__right">
        {meta && <span className="menu-row__meta">{meta}</span>}
        <span className="menu-row__chev">›</span>
      </span>
    </PrefetchLink>
  )
}

export function SettingsMenu({ data, activeOrders }: { data: SettingsData; activeOrders: number }) {
  const initials = (data.displayName || data.username).slice(0, 2).toUpperCase()
  const sizesChip = sizesChipLabel(data.sizes)
  const anyPush = PREF_ROWS.some((r) => data.prefs[`push_${r.id}` as keyof NotificationPrefs])
  const anyEmail = PREF_ROWS.some((r) => data.prefs[`email_${r.id}` as keyof NotificationPrefs])
  const notifMeta = data.notificationsEnabled ? [anyPush && 'PUSH', anyEmail && 'EMAIL'].filter(Boolean).join(' + ') || 'OFF' : 'SOON'
  const memberYear = data.memberSince ? data.memberSince.slice(-4) : ''

  return (
    <div className="settings-menu" data-testid="settings-menu">
      <div className="menu-profile">
        <span className="menu-profile__avatar" style={data.avatarUrl ? { backgroundImage: `url(${data.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>{initials}</span>
        <span className="menu-profile__main">
          <span className="menu-profile__name">{data.displayName || data.username}</span>
          <span className="menu-profile__meta">
            @{data.username}
            {memberYear ? <span className="menu-profile__since">Member since {memberYear}</span> : null}
          </span>
        </span>
        <PrefetchLink href="/settings/profile" className="link-underline link-underline--ink menu-profile__edit">EDIT</PrefetchLink>
      </div>
      <div className="menu-group">ACCOUNT</div>
      <MenuRow href="/settings/profile" label="Profile" />
      <MenuRow href="/settings/orders" label="Orders" meta={activeOrders ? `${activeOrders} ACTIVE` : undefined} />
      <MenuRow href="/settings/address" label="Addresses" meta={data.addresses.length ? `${data.addresses.length} SAVED` : undefined} />
      <MenuRow href="/settings/payouts" label="Payments & payouts" meta={data.payoutsEnabled ? 'ACTIVE' : 'NOT SET'} />
      <MenuRow href="/settings/sizes" label="My sizes" meta={sizesChip === 'NONE SET' ? undefined : sizesChip.replace(/ · /g, ' / ')} />
      {data.phoneVerificationEnabled && <MenuRow href="/settings/phone" label="Phone" meta={data.phoneVerified ? 'VERIFIED' : undefined} />}
      <div className="menu-group menu-group--ruled">PREFERENCES</div>
      <MenuRow href="/settings/notifications" label="Notifications" meta={notifMeta} />
      <div className="menu-row menu-row--static">
        Theme
        <ThemeSegment options={['light', 'dark', 'system']} />
      </div>
      {data.tierDashboardEnabled && (
        <>
          <div className="menu-group menu-group--ruled">SELLING</div>
          <MenuRow href="/settings/tiers" label="Fees & tiers" />
        </>
      )}
      <div className="menu-foot">
        <SignOutLink className="menu-foot__signout" label="Sign out" />
      </div>
    </div>
  )
}

export default function SettingsSections({ section, data }: { section: SettingsSection; data: SettingsData }) {
  switch (section) {
    case 'profile': return <HubSection data={data} asProfile />
    case 'orders': return <OrdersSection data={data} />
    case 'review': return <ReviewSection data={data} />
    case 'address': return <AddressSection data={data} />
    case 'sizes': return <SizesSection data={data} />
    case 'notifications': return <NotificationsSection data={data} />
    case 'payouts': return <PayoutsSection data={data} />
    case 'phone': return <PhoneSection data={data} />
    case 'tiers': return <TiersSection data={data} />
    default: return <HubSection data={data} />
  }
}
