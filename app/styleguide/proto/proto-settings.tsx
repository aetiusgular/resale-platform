'use client'

/**
 * Proto settings shell — the same ACCOUNT rail + section body as app/settings
 * (settings-shell.tsx), rendered from fixtures instead of a Supabase read so the
 * tour can show SETTINGS / ORDERS / ADDRESS / MY SIZES / NOTIFICATIONS / PAYOUTS
 * without a session. The section bodies are the REAL `SettingsSections`; the
 * ProtoBaseProvider is what keeps their internal links inside the tour.
 *
 * Sign out is omitted here: there is no session to end.
 */
import PrefetchLink from '@/app/components/prefetch-link'
import { ProtoBaseProvider } from '@/app/components/proto-base'
import { sizesChipLabel } from '@/lib/sizes'
import SettingsSections, { SettingsMenu, type SettingsSection } from '@/app/settings/settings-sections'
import { PROTO_ACTIVE_ORDERS, PROTO_SETTINGS } from '@/app/proto/account-fixtures'
import { PROTO_BASE } from '@/app/proto/viewer-fixture'

export default function ProtoSettings({ section }: { section: SettingsSection }) {
  const data = PROTO_SETTINGS
  const chip = sizesChipLabel(data.sizes)
  const nav: Array<{ id: SettingsSection; label: string; href: string; meta?: React.ReactNode }> = [
    { id: 'hub', label: 'SETTINGS', href: `${PROTO_BASE}/settings` },
    { id: 'orders', label: 'ORDERS', href: `${PROTO_BASE}/settings/orders`, meta: PROTO_ACTIVE_ORDERS ? `${PROTO_ACTIVE_ORDERS} ACTIVE` : undefined },
    { id: 'address', label: 'ADDRESS', href: `${PROTO_BASE}/settings/address`, meta: data.addresses.length ? String(data.addresses.length) : undefined },
    { id: 'sizes', label: 'MY SIZES', href: `${PROTO_BASE}/settings/sizes`, meta: chip === 'NONE SET' ? undefined : chip },
    { id: 'notifications', label: 'NOTIFICATIONS', href: `${PROTO_BASE}/settings/notifications` },
    { id: 'payouts', label: 'PAYOUTS', href: `${PROTO_BASE}/settings/payouts`, meta: <span className={`tag${section === 'payouts' ? ' tag--ink' : ''}`}>{data.payoutsEnabled ? 'ACTIVE' : 'NOT SET'}</span> },
  ]
  if (data.phoneVerificationEnabled) nav.push({ id: 'phone', label: 'PHONE', href: `${PROTO_BASE}/settings/phone`, meta: data.phoneVerified ? 'VERIFIED' : undefined })
  if (data.tierDashboardEnabled) nav.push({ id: 'tiers', label: 'FEES & TIERS', href: `${PROTO_BASE}/settings/tiers` })
  const activeNav = section === 'review' ? 'orders' : section === 'profile' ? 'hub' : section

  return (
    <ProtoBaseProvider base={PROTO_BASE}>
      <div className="layout">
        <aside className="rail">
          <div className="rail__top">
            <span className="rail__title">ACCOUNT</span>
            <span className="rail__handle">@{data.username.toUpperCase()}</span>
          </div>
          {nav.map((n, i) => {
            const on = n.id === activeNav
            return (
              <PrefetchLink key={n.id} className={`side-link${i === nav.length - 1 ? ' side-link--last' : ''}`} href={n.href} aria-current={on ? 'page' : undefined}>
                <span className="side-link__left">
                  <span className={`dot${on ? ' is-on' : ''}`} />
                  <span className={`side-link__label${on ? ' is-on' : ''}`}>{n.label}</span>
                </span>
                {typeof n.meta === 'string' ? <span className="side-link__meta">{n.meta}</span> : n.meta}
              </PrefetchLink>
            )
          })}
        </aside>
        <main className="main main--settings">
          {section === 'hub' && <SettingsMenu data={data} activeOrders={PROTO_ACTIVE_ORDERS} />}
          <div className={`settings-section${section === 'hub' ? ' settings-desk' : ''}`}>
            <SettingsSections section={section} data={data} />
          </div>
        </main>
      </div>
    </ProtoBaseProvider>
  )
}
