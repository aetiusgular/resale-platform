/**
 * Settings shell (design 2A–2E): ACCOUNT rail (SETTINGS · ORDERS · ADDRESS ·
 * MY SIZES · NOTIFICATIONS · PAYOUTS [· PHONE · FEES & TIERS]) + one section.
 * Server component — loads everything the sections need once, then renders the
 * requested section. Routes: /settings (hub), /settings/<section>,
 * /settings/orders, /settings/review?order=<id>.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import { sizesChipLabel } from '@/lib/sizes'
import { PHONE_VERIFICATION_ENABLED, TIER_DASHBOARD_ENABLED } from '@/lib/flags'
import { loadSettings } from '@/lib/loaders/settings'
import SettingsSections, { SettingsMenu, type SettingsSection } from './settings-sections'
import SignOutLink from './sign-out-link'
import { BRAND_STAGE } from '@/app/components/brand'

const LEGACY_SECTIONS: Record<string, SettingsSection> = {
  'my-sizes': 'sizes', addresses: 'address', payments: 'payouts', power: 'tiers',
}

export function resolveSection(raw: string | undefined): SettingsSection {
  if (!raw) return 'hub'
  if (raw in LEGACY_SECTIONS) return LEGACY_SECTIONS[raw]
  const known: SettingsSection[] = ['hub', 'profile', 'orders', 'review', 'address', 'sizes', 'notifications', 'payouts', 'phone', 'tiers']
  return known.includes(raw as SettingsSection) ? (raw as SettingsSection) : 'hub'
}

export default async function SettingsShell({
  section, payoutOnboardingDone = false, reviewOrderId = null,
}: { section: SettingsSection; payoutOnboardingDone?: boolean; reviewOrderId?: string | null }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // ONE data assembly shared with GET /api/settings/{profile,orders,review} (native clients).
  const { data, activeOrders } = await loadSettings({
    supabase,
    user,
    includeOrders: section === 'orders',
    reviewOrderId: section === 'review' ? reviewOrderId : null,
    payoutOnboardingDone,
  })
  const { username, displayName, sizes, addresses, payoutsEnabled } = data

  const chip = sizesChipLabel(sizes)
  const nav: Array<{ id: SettingsSection; label: string; href: string; meta?: React.ReactNode }> = [
    { id: 'hub', label: 'SETTINGS', href: '/settings' },
    { id: 'orders', label: 'ORDERS', href: '/settings/orders', meta: activeOrders ? `${activeOrders} ACTIVE` : undefined },
    { id: 'address', label: 'ADDRESS', href: '/settings/address', meta: addresses.length ? String(addresses.length) : undefined },
    { id: 'sizes', label: 'MY SIZES', href: '/settings/sizes', meta: chip === 'NONE SET' ? undefined : chip },
    { id: 'notifications', label: 'NOTIFICATIONS', href: '/settings/notifications' },
    { id: 'payouts', label: 'PAYOUTS', href: '/settings/payouts', meta: <span className={`tag${section === 'payouts' ? ' tag--ink' : ''}`}>{payoutsEnabled ? 'ACTIVE' : 'NOT SET'}</span> },
  ]
  if (PHONE_VERIFICATION_ENABLED) nav.push({ id: 'phone', label: 'PHONE', href: '/settings/phone', meta: data.phoneVerified ? 'VERIFIED' : undefined })
  if (TIER_DASHBOARD_ENABLED) nav.push({ id: 'tiers', label: 'FEES & TIERS', href: '/settings/tiers' })
  const activeNav = section === 'review' ? 'orders' : section === 'profile' ? 'hub' : section

  return (
    <AppShell username={username} displayName={displayName ?? undefined}>
      <div className="layout">
        <aside className="rail">
          <div className="rail__top">
            <span className="rail__title">ACCOUNT</span>
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
          <div className="rail__signout"><SignOutLink /></div>
        </aside>
        <main className="main main--settings">
          {/* ≤720px (mobile-web 09): the hub is a menu into the sections; each section carries
              a "← SETTINGS" back link (Crumb). The desktop hub body hides there. */}
          {section === 'hub' && <SettingsMenu data={data} activeOrders={activeOrders} stage={BRAND_STAGE} />}
          <div className={`settings-section${section === 'hub' ? ' settings-desk' : ''}`}>
            <SettingsSections section={section} data={data} />
          </div>
        </main>
      </div>
    </AppShell>
  )
}
