/**
 * Settings shell (design 2A–2E): ACCOUNT rail (SETTINGS · ORDERS · ADDRESS ·
 * MY SIZES · NOTIFICATIONS · PAYOUTS [· PHONE · FEES & TIERS]) + one section.
 * Server component — loads everything the sections need once, then renders the
 * requested section. Routes: /settings (hub), /settings/<section>,
 * /settings/orders, /settings/review?order=<id>.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED, PHONE_VERIFICATION_ENABLED, REVIEWS_ENABLED, SHIPPING_LABELS_ENABLED, TIER_DASHBOARD_ENABLED } from '@/lib/flags'
import { getTierDashboard, type SideDashboard } from '@/lib/tier-dashboard'
import { WELCOME_SALES, formatCents } from '@/lib/fees'
import { canLeaveReview, type ReviewDirection } from '@/lib/reviews/eligibility'
import type { OrderState } from '@/lib/orders'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import { normalizeSizes, sizesChipLabel } from '@/lib/sizes'
import { DEFAULT_PREFS } from '@/lib/notify/prefs'
import type { NotificationPrefs } from '@/lib/notify/types'
import SettingsSections, { SettingsMenu, type SettingsData, type SettingsSection, type SettingsAddress, type SettingsOrderRow, type ReviewTarget } from './settings-sections'
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

const ACTIVE_ORDER_STATES = ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed']
const ORDER_COLS = 'id, listing_id, buyer_id, seller_id, state, total_cents, transfer_cents, created_at, tracking_number, delivered_at, released_at'

type OrderRowRaw = {
  id: string; listing_id: string; buyer_id: string; seller_id: string; state: string
  total_cents: number; transfer_cents: number; created_at: string; tracking_number: string | null
  delivered_at: string | null; released_at: string | null
}

export default async function SettingsShell({
  section, payoutOnboardingDone = false, reviewOrderId = null,
}: { section: SettingsSection; payoutOnboardingDone?: boolean; reviewOrderId?: string | null }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Own-profile read via the service role: sensitive columns (phone, addresses, Stripe
  // Connect id) are no longer granted to the `authenticated` role (migration 0044 —
  // pre-launch audit Finding 1). Scoped to the caller's own id, so it reads only their row.
  const svc = createServiceClientRaw()
  const [{ data: profile }, { data: prefsRow }, { count: activeOrders }, { data: addressRows }, sellerTier] = await Promise.all([
    svc
      .from('profiles')
      .select('username, display_name, avatar_url, username_changed_at, hide_not_my_size, sizes, payouts_enabled, phone, phone_verified_at, created_at, lifetime_sales_count, id_verification_status')
      .eq('id', user.id)
      .single(),
    supabase.from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .in('state', ACTIVE_ORDER_STATES),
    supabase.from('addresses').select('id, name, street1, street2, city, state, zip, country, is_default, created_at').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
    getTierDashboard(svc, user.id, 'seller'),
  ])

  let buyerTier: SideDashboard | null = null
  if (TIER_DASHBOARD_ENABLED) buyerTier = await getTierDashboard(svc, user.id, 'buyer')

  const username: string = (profile?.username as string) ?? ''
  const displayName = (profile?.display_name as string | null) ?? null
  const sizes = normalizeSizes(profile?.sizes)
  const addresses = ((addressRows ?? []) as SettingsAddress[])
  const payoutsEnabled = (profile?.payouts_enabled as boolean) ?? false
  const salesCount = (profile?.lifetime_sales_count as number) ?? 0
  const welcomeLeft = Math.max(0, WELCOME_SALES - salesCount)
  const prefsMerged: NotificationPrefs = { ...DEFAULT_PREFS, ...((prefsRow ?? {}) as Partial<NotificationPrefs>) }
  const changedAt = profile?.username_changed_at ? Date.parse(profile.username_changed_at as string) : null
  const usernameNextChangeAt = changedAt ? changedAt + 30 * 24 * 60 * 60 * 1000 : null
  // eslint-disable-next-line react-hooks/purity -- server component render; request-time clock
  const nowMs = Date.now()
  const usernameWindowOpen = usernameNextChangeAt === null || usernameNextChangeAt <= nowMs
  // Next quarterly tier review: first day of the next quarter (UTC).
  const nowD = new Date(nowMs)
  const q = Math.floor(nowD.getUTCMonth() / 3)
  const tierReviewDateMs = Date.UTC(nowD.getUTCFullYear() + (q === 3 ? 1 : 0), ((q + 1) % 4) * 3, 1)

  // ── ORDERS section rows (only loaded there) ────────────────────────────────
  let orders: SettingsOrderRow[] = []
  if (section === 'orders') {
    const [{ data: buysData }, { data: salesData }] = await Promise.all([
      supabase.from('orders').select(ORDER_COLS).eq('buyer_id', user.id).order('created_at', { ascending: false }),
      supabase.from('orders').select(ORDER_COLS).eq('seller_id', user.id).order('created_at', { ascending: false }),
    ])
    const purchases = (buysData ?? []) as OrderRowRaw[]
    const salesRows = (salesData ?? []) as OrderRowRaw[]
    const all = [...purchases.map((o) => ({ o, role: 'buyer' as const })), ...salesRows.map((o) => ({ o, role: 'seller' as const }))]
    const listingIds = Array.from(new Set(all.map(({ o }) => o.listing_id)))
    const counterpartyIds = Array.from(new Set(all.map(({ o, role }) => (role === 'buyer' ? o.seller_id : o.buyer_id))))
    const reviewedOrderIds = new Set<string>()
    const [{ data: listingRows }, { data: profileRows }, { data: myReviews }] = await Promise.all([
      listingIds.length ? svc.from('listings').select('id, title, brand, size, images').in('id', listingIds) : Promise.resolve({ data: [] }),
      counterpartyIds.length ? supabase.from('profiles').select('id, username').in('id', counterpartyIds) : Promise.resolve({ data: [] }),
      REVIEWS_ENABLED ? supabase.from('reviews').select('order_id').eq('reviewer_id', user.id) : Promise.resolve({ data: [] }),
    ])
    for (const r of (myReviews ?? []) as Array<{ order_id: string }>) reviewedOrderIds.add(r.order_id)
    const listingMap = new Map((listingRows ?? []).map((l) => [l.id as string, l as { title: string; brand: string; size: string; images: string[] }]))
    const nameMap = new Map((profileRows ?? []).map((p) => [p.id as string, p.username as string]))
    orders = all
      .map(({ o, role }) => {
        const l = listingMap.get(o.listing_id)
        return {
          id: o.id,
          role,
          state: o.state,
          brand: l?.brand ?? '',
          title: l?.title ?? 'Unknown',
          size: l?.size ?? '',
          image: (Array.isArray(l?.images) ? l.images : []).find(Boolean) ?? null,
          amount: formatCents(role === 'buyer' ? o.total_cents : o.transfer_cents),
          counterparty: nameMap.get(role === 'buyer' ? o.seller_id : o.buyer_id) ?? (role === 'buyer' ? 'seller' : 'buyer'),
          created_at: o.created_at,
          hasTracking: !!o.tracking_number,
          canReview: REVIEWS_ENABLED && role === 'buyer' && o.state === 'released' && !reviewedOrderIds.has(o.id),
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // ── REVIEW section target (LEAVE FEEDBACK →) ───────────────────────────────
  let review: ReviewTarget | null = null
  if (section === 'review' && reviewOrderId) {
    const { data: o } = await supabase.from('orders').select(ORDER_COLS).eq('id', reviewOrderId).maybeSingle()
    if (o) {
      const row = o as OrderRowRaw
      const [{ data: l }, { data: existing }, { data: seller }] = await Promise.all([
        svc.from('listings').select('title, brand, size, images').eq('id', row.listing_id).maybeSingle(),
        supabase.from('reviews').select('direction').eq('order_id', row.id),
        supabase.from('profiles').select('username').eq('id', row.seller_id).maybeSingle(),
      ])
      const existingDirections = ((existing ?? []) as Array<{ direction: ReviewDirection }>).map((r) => r.direction)
      const elig = canLeaveReview({ buyerId: row.buyer_id, sellerId: row.seller_id, state: row.state as OrderState }, user.id, { existingDirections })
      review = {
        orderId: row.id,
        brand: (l?.brand as string) ?? '',
        title: (l?.title as string) ?? 'Unknown',
        image: (Array.isArray(l?.images) ? (l.images as string[]) : []).find(Boolean) ?? null,
        amount: formatCents(row.total_cents),
        deliveredAt: row.delivered_at ?? row.released_at ?? row.created_at,
        sellerUsername: (seller?.username as string) ?? 'seller',
        eligible: REVIEWS_ENABLED && elig.ok,
        reason: elig.ok ? null : elig.reason,
      }
    }
  }

  const data: SettingsData = {
    userId: user.id,
    username,
    displayName,
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    usernameNextChangeAt,
    usernameWindowOpen,
    tierReviewDateMs,
    email: user.email ?? '',
    emailVerified: !!user.email_confirmed_at,
    memberSince: profile?.created_at ? new Date(profile.created_at as string).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '',
    idVerified: profile?.id_verification_status === 'verified',
    sizes,
    hideNotMySize: !!profile?.hide_not_my_size,
    addresses,
    payoutsEnabled,
    payoutOnboardingDone,
    prefs: prefsMerged,
    notificationsEnabled: NOTIFICATIONS_ENABLED,
    phoneVerificationEnabled: PHONE_VERIFICATION_ENABLED,
    phoneVerified: Boolean(profile?.phone_verified_at),
    phone: (profile?.phone as string | null) ?? null,
    tierDashboardEnabled: TIER_DASHBOARD_ENABLED,
    buyerTier,
    sellerTier,
    welcomeLeft,
    salesCount,
    reviewsEnabled: REVIEWS_ENABLED,
    shippingLabelsEnabled: SHIPPING_LABELS_ENABLED,
    orders,
    review,
  }

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
            <span className="rail__handle">@{username.toUpperCase()}</span>
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
          {section === 'hub' && <SettingsMenu data={data} activeOrders={activeOrders ?? 0} stage={BRAND_STAGE} />}
          <div className={`settings-section${section === 'hub' ? ' settings-desk' : ''}`}>
            <SettingsSections section={section} data={data} />
          </div>
        </main>
      </div>
    </AppShell>
  )
}
