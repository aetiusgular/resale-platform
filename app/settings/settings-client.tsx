'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PushSubscribe from '@/app/components/push-subscribe'
import PhoneVerify from './phone-verify'
import TierDashboard from './tier-dashboard'
import type { SideDashboard } from '@/lib/tier-dashboard'

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface SizesMap {
  tops?: string[]
  bottoms?: string[]
  footwear?: string[]
}

type NotifPrefs = {
  email_offers: boolean; push_offers: boolean
  email_orders: boolean; push_orders: boolean
  email_messages: boolean; push_messages: boolean
  email_alerts: boolean; push_alerts: boolean
}

interface Props {
  username: string
  initialSizes: SizesMap
  payoutsEnabled: boolean
  stripeConnectId: string | null
  initialPrefs: NotifPrefs
  notificationsEnabled: boolean
  phoneVerificationEnabled: boolean
  phoneVerified: boolean
  initialPhone: string | null
  tierDashboardEnabled: boolean
  buyerTier: SideDashboard | null
  sellerTier: SideDashboard | null
}

/* ─── Size options ──────────────────────────────────────────────────────── */

const SIZE_OPTIONS = {
  tops: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  bottoms: ['26', '28', '30', '32', '34', '36', '38', '40'],
  footwear: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14'],
} as const

/* ─── Nav items ─────────────────────────────────────────────────────────── */

const NAV_SECTIONS = [
  {
    label: 'ACCOUNT',
    items: [
      { key: 'profile', label: 'Profile' },
      { key: 'my-sizes', label: 'My sizes' },
      { key: 'addresses', label: 'Addresses' },
      { key: 'payments', label: 'Payments' },
      { key: 'power', label: 'Fees & tiers' },
    ],
  },
  {
    label: 'SELLING',
    items: [
      { key: 'listings', label: 'Listings' },
      { key: 'offers', label: 'Offers' },
      { key: 'vacation-mode', label: 'Vacation mode' },
    ],
  },
  {
    label: 'TRUST',
    items: [
      { key: 'verification', label: 'Verification' },
      { key: 'phone', label: 'Phone' },
      { key: 'privacy', label: 'Privacy' },
      { key: 'notifications', label: 'Notifications' },
    ],
  },
]

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function SettingsClient({ initialSizes, payoutsEnabled, stripeConnectId, initialPrefs, notificationsEnabled, phoneVerificationEnabled, phoneVerified, initialPhone, tierDashboardEnabled, buyerTier, sellerTier }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const section = searchParams.get('section')
  const activeSection = section || 'my-sizes'

  /* --- My Sizes state --- */
  const [sizes, setSizes] = useState<SizesMap>(() => ({
    tops: initialSizes.tops ?? [],
    bottoms: initialSizes.bottoms ?? [],
    footwear: initialSizes.footwear ?? [],
  }))
  const [saving, setSaving] = useState(false)

  const isDirty = useMemo(() => {
    return JSON.stringify(sizes) !== JSON.stringify({
      tops: initialSizes.tops ?? [],
      bottoms: initialSizes.bottoms ?? [],
      footwear: initialSizes.footwear ?? [],
    })
  }, [sizes, initialSizes])

  const toggleSize = useCallback((category: keyof SizesMap, size: string) => {
    setSizes(prev => {
      const current = prev[category] ?? []
      const next = current.includes(size)
        ? current.filter(s => s !== size)
        : [...current, size]
      return { ...prev, [category]: next }
    })
  }, [])

  const saveSizes = useCallback(async () => {
    if (!isDirty || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/sizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizes }),
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [sizes, isDirty, saving, router])

  /* --- Navigate to section --- */
  const goToSection = useCallback((key: string) => {
    router.push(`/settings?section=${key}`)
  }, [router])

  const goBack = useCallback(() => {
    router.push('/settings')
  }, [router])

  /* --- Render pane content --- */
  function renderPane() {
    switch (activeSection) {
      case 'my-sizes':
        return <MySizesPane sizes={sizes} toggleSize={toggleSize} isDirty={isDirty} saving={saving} onSave={saveSizes} />
      case 'addresses':
        return <AddressesPane />
      case 'payments':
        return <PaymentsPane payoutsEnabled={payoutsEnabled} stripeConnectId={stripeConnectId} />
      case 'notifications':
        return notificationsEnabled ? <NotificationsPane initialPrefs={initialPrefs} /> : <PlaceholderPane label="Notifications" />
      case 'phone':
        return phoneVerificationEnabled ? <PhoneVerify verified={phoneVerified} initialPhone={initialPhone} /> : <PlaceholderPane label="Phone" />
      case 'power':
        return tierDashboardEnabled && buyerTier && sellerTier ? <TierDashboard buyer={buyerTier} seller={sellerTier} /> : <PlaceholderPane label="Fees & tiers" />
      default:
        return <PlaceholderPane label={NAV_SECTIONS.flatMap(s => s.items).find(i => i.key === activeSection)?.label ?? activeSection} />
    }
  }

  return (
    <>
      {/* ─── DESKTOP: rail + pane ─────────────────────────────── */}
      <div className="settings-desktop">
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '48px 0 96px',
          display: 'grid', gridTemplateColumns: '200px 1fr', gap: 64,
          alignItems: 'start',
        }}>
          <NavRail activeSection={activeSection} onSelect={goToSection} />
          <div style={{ maxWidth: 640 }}>
            {renderPane()}
          </div>
        </div>
      </div>

      {/* ─── MOBILE: index or detail ─────────────────────────── */}
      <div className="settings-mobile">
        {!section ? (
          /* Index */
          <div>
            <div style={{
              height: 56, borderBottom: '1px solid var(--color-line)',
              display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
            }}>
              <Link href="/" style={{
                flex: 'none', fontSize: 20, lineHeight: '1',
                color: 'var(--color-ink)', textDecoration: 'none',
                minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>&#8249;</Link>
              <span style={{
                flex: 1, textAlign: 'center',
                font: '600 14px var(--font-ui)', letterSpacing: '-0.01em',
                color: 'var(--color-ink)',
              }}>Settings</span>
              <span style={{ flex: 'none', width: 20 }} />
            </div>
            <div style={{ padding: '24px 16px 32px' }}>
              {NAV_SECTIONS.map((group, gi) => (
                <div key={group.label}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
                    paddingBottom: 8,
                    ...(gi > 0 ? { paddingTop: 28 } : {}),
                  }}>{group.label}</div>
                  {group.items.map((item, ii) => (
                    <div
                      key={item.key}
                      onClick={() => goToSection(item.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 0',
                        borderTop: '1px solid var(--color-line)',
                        cursor: 'pointer',
                        ...(gi === NAV_SECTIONS.length - 1 && ii === group.items.length - 1
                          ? { borderBottom: '1px solid var(--color-line)' }
                          : {}),
                      }}
                    >
                      <span style={{
                        font: '500 12px var(--font-ui)', letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--color-ink)',
                      }}>{item.label}</span>
                      <span style={{ fontSize: 16, color: 'var(--color-ink-soft)' }}>&rsaquo;</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Detail */
          <div>
            <div style={{
              height: 56, borderBottom: '1px solid var(--color-line)',
              display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
            }}>
              <span
                onClick={goBack}
                style={{
                  flex: 'none', fontSize: 20, lineHeight: '1',
                  color: 'var(--color-ink)', cursor: 'pointer',
                  minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>&#8249;</span>
              <span style={{
                flex: 1, textAlign: 'center',
                font: '600 14px var(--font-ui)', letterSpacing: '-0.01em',
                color: 'var(--color-ink)',
              }}>
                {NAV_SECTIONS.flatMap(s => s.items).find(i => i.key === activeSection)?.label ?? 'Settings'}
              </span>
              <span style={{ flex: 'none', width: 20 }} />
            </div>
            <div style={{ padding: '20px 16px 32px' }}>
              {renderPane()}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .settings-desktop { display: block; }
        .settings-mobile { display: none; }
        @media (max-width: 767px) {
          .settings-desktop { display: none !important; }
          .settings-mobile { display: block !important; }
        }
      `}</style>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Nav Rail (desktop) ────────────────────────────────────────────────── */

function NavRail({ activeSection, onSelect }: { activeSection: string; onSelect: (key: string) => void }) {
  return (
    <nav aria-label="Settings" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {NAV_SECTIONS.map(group => (
        <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
            marginBottom: 6,
          }}>{group.label}</span>
          {group.items.map(item => {
            const isActive = item.key === activeSection
            return (
              <span
                key={item.key}
                onClick={() => onSelect(item.key)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') onSelect(item.key) }}
                style={{
                  padding: '5px 0 5px 10px',
                  borderLeft: `2px solid ${isActive ? 'var(--color-ink)' : 'transparent'}`,
                  font: '500 11px var(--font-ui)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                  cursor: 'pointer',
                  transition: 'color 120ms linear',
                }}
              >{item.label}</span>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/* ─── Size chip ─────────────────────────────────────────────────────────── */

function SizeChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        display: 'inline-flex', alignItems: 'center',
        height: 28, padding: '0 10px',
        border: `1px solid ${selected ? 'var(--color-ink)' : 'var(--color-line)'}`,
        borderRadius: 2,
        background: selected ? 'var(--color-ink)' : 'var(--color-bg)',
        color: selected ? 'var(--color-bg)' : 'var(--color-ink)',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        cursor: 'pointer',
        transition: 'border-color 120ms linear',
      }}
    >{label}</span>
  )
}

/* ─── My Sizes pane ─────────────────────────────────────────────────────── */

function MySizesPane({
  sizes, toggleSize, isDirty, saving, onSave,
}: {
  sizes: SizesMap
  toggleSize: (cat: keyof SizesMap, size: string) => void
  isDirty: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
        My sizes
      </h1>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-ink-soft)' }}>
        used by the MY SIZES filter and size alerts — never shown publicly.
      </div>

      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {(Object.keys(SIZE_OPTIONS) as Array<keyof typeof SIZE_OPTIONS>).map(category => (
          <div key={category}>
            <div style={{
              font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--color-ink)',
              marginBottom: 10,
            }}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SIZE_OPTIONS[category].map(size => (
                <SizeChip
                  key={size}
                  label={size}
                  selected={(sizes[category] ?? []).includes(size)}
                  onClick={() => toggleSize(category, size)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          data-testid="sizes-save-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            whiteSpace: 'nowrap', height: 44, padding: '0 32px',
            background: 'var(--color-ink)', color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)', borderRadius: 2,
            font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
            opacity: isDirty && !saving ? 1 : 0.35,
            cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
            transition: 'opacity 120ms linear',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {!isDirty && (
          <span style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>
            enabled when something changes
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Addresses pane ────────────────────────────────────────────────────── */

function AddressesPane() {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
        Addresses
      </h1>
      <div style={{ marginTop: 24, maxWidth: 560 }}>
        <div style={{
          border: '1px solid var(--color-line)', borderRadius: 2,
          padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
          }}>NO ADDRESSES SAVED</span>
          <span style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>
            add a shipping address here and it will pre-fill at checkout.
          </span>
          <button
            disabled
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              whiteSpace: 'nowrap', height: 44, padding: '0 24px',
              background: 'var(--color-bg)', color: 'var(--color-ink)',
              border: '1px solid var(--color-ink)', borderRadius: 2,
              font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
              cursor: 'not-allowed', opacity: 0.5,
            }}
          >Add address</button>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
          }}>COMING SOON</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Payments pane ─────────────────────────────────────────────────────── */

function PaymentsPane({ payoutsEnabled }: { payoutsEnabled: boolean; stripeConnectId: string | null }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
        Payments
      </h1>

      {/* Payment methods section */}
      <div style={{
        marginTop: 24,
        font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-ink-soft)',
        borderBottom: '1px solid var(--color-line)', paddingBottom: 10,
        maxWidth: 560,
      }}>Payment methods</div>

      <div style={{ marginTop: 16, maxWidth: 560 }}>
        <div style={{
          border: '1px solid var(--color-line)', borderRadius: 2,
          padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
          }}>NO PAYMENT METHODS SAVED</span>
          <span style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>
            saved methods pre-fill checkout — you can still use a different card on any purchase.
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          marginTop: 12,
          fontSize: 12, lineHeight: '1.6', color: 'var(--color-ink-soft)',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ flex: 'none', marginTop: 3 }}>
            <rect x="2" y="5" width="8" height="5.5" rx="0.5" />
            <path d="M4 5V3.5a2 2 0 014 0V5" />
          </svg>
          <span>stored with our payment providers (Stripe / PayPal) — card numbers never touch our servers.</span>
        </div>
      </div>

      {/* Payouts section */}
      <div style={{
        marginTop: 40,
        font: '500 11px var(--font-ui)', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-ink-soft)',
        borderBottom: '1px solid var(--color-line)', paddingBottom: 10,
        maxWidth: 560,
      }}>Payouts</div>

      <div style={{ marginTop: 16, maxWidth: 560 }}>
        {payoutsEnabled ? (
          <div style={{
            border: '1px solid var(--color-line)', borderRadius: 2,
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ color: 'var(--color-accent)', fontSize: 13, flex: 'none' }}>&#10003;</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              letterSpacing: '0.08em', color: 'var(--color-ink)', whiteSpace: 'nowrap',
            }}>PAYOUT ACCOUNT &middot; CONNECTED</span>
            <a href="/api/stripe/connect" style={{
              marginLeft: 'auto', fontSize: 12, color: 'var(--color-ink)', whiteSpace: 'nowrap',
            }}>manage in Stripe</a>
          </div>
        ) : (
          <div style={{
            border: '1px solid var(--color-line)', borderRadius: 2,
            padding: '20px 16px',
            display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
            }}>PAYOUT ACCOUNT &middot; NOT CONNECTED</span>
            <a
              href="/api/stripe/connect"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                whiteSpace: 'nowrap', height: 44, padding: '0 32px',
                background: 'var(--color-ink)', color: 'var(--color-bg)',
                border: '1px solid var(--color-ink)', borderRadius: 2,
                font: '500 14px var(--font-ui)', letterSpacing: '-0.01em',
                textDecoration: 'none',
                cursor: 'pointer', transition: 'opacity 120ms linear',
              }}
            >Set up payouts</a>
            <span style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>
              required before your first listing goes live.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Placeholder pane ──────────────────────────────────────────────────── */

const NOTIF_CATEGORIES = [
  { key: 'offers', label: 'Offers', desc: 'New offers and accepted offers' },
  { key: 'orders', label: 'Orders', desc: 'Sales, shipping, delivery, and disputes' },
  { key: 'messages', label: 'Messages', desc: 'New messages from buyers and sellers' },
  { key: 'alerts', label: 'Saved searches', desc: 'New listings that match a search you saved' },
] as const

function NotificationsPane({ initialPrefs }: { initialPrefs: NotifPrefs }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(initialPrefs)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(initialPrefs), [prefs, initialPrefs])

  const toggle = (k: keyof NotifPrefs) => { setPrefs((p) => ({ ...p, [k]: !p[k] })); setSaved(false) }
  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/notifications/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>Notifications</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
        In-app notifications are always on. Choose which categories also reach you by email and push.
      </p>
      <div style={{ marginTop: 24, border: '1px solid var(--color-line)', borderRadius: 2 }}>
        <div style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid var(--color-line)' }}>
          <span style={{ flex: 1 }} />
          <span style={{ width: 72, textAlign: 'center', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Email</span>
          <span style={{ width: 72, textAlign: 'center', font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)' }}>Push</span>
        </div>
        {NOTIF_CATEGORIES.map((c) => {
          const emailKey = `email_${c.key}` as keyof NotifPrefs
          const pushKey = `push_${c.key}` as keyof NotifPrefs
          return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--color-line)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)' }}>{c.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>{c.desc}</div>
              </div>
              <label style={{ width: 72, display: 'inline-flex', justifyContent: 'center', minHeight: 44, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefs[emailKey]} onChange={() => toggle(emailKey)} aria-label={`${c.label} email`} style={{ width: 18, height: 18 }} />
              </label>
              <label style={{ width: 72, display: 'inline-flex', justifyContent: 'center', minHeight: 44, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={prefs[pushKey]} onChange={() => toggle(pushKey)} aria-label={`${c.label} push`} style={{ width: 18, height: 18 }} />
              </label>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={save} disabled={!dirty || saving} style={{ height: 40, padding: '0 24px', background: dirty ? 'var(--color-ink)' : 'var(--color-line)', color: dirty ? 'var(--color-bg)' : 'var(--color-ink-soft)', border: 'none', borderRadius: 2, font: '500 14px var(--font-ui)', cursor: dirty && !saving ? 'pointer' : 'default' }}>
          {saving ? 'Saving\u2026' : 'Save preferences'}
        </button>
        {saved && !dirty && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>Saved</span>}
      </div>
      <PushSubscribe />
    </div>
  )
}

function PlaceholderPane({ label }: { label: string }) {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
        {label}
      </h1>
      <div style={{
        marginTop: 24, border: '1px solid var(--color-line)', borderRadius: 2,
        padding: '20px 16px',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.08em', color: 'var(--color-ink-soft)',
        }}>COMING SOON</span>
      </div>
    </div>
  )
}
