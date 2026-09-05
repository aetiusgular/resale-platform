/**
 * Settings loader — the data behind the /settings shell (2A–2E, orders, review) and the
 * native routes GET /api/settings/profile, GET /api/settings/orders, GET /api/settings/review.
 *
 * Own-profile read via the service role: sensitive columns (phone, addresses, Stripe Connect id)
 * are no longer granted to the `authenticated` role (migration 0044). Scoped to the caller's own
 * id, so it reads only their row. Everything else goes through the caller's client (RLS).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED, PHONE_VERIFICATION_ENABLED, REVIEWS_ENABLED, SHIPPING_LABELS_ENABLED, TIER_DASHBOARD_ENABLED } from '@/lib/flags'
import { getTierDashboard, type SideDashboard } from '@/lib/tier-dashboard'
import { WELCOME_SALES, formatCents } from '@/lib/fees'
import { canLeaveReview, type ReviewDirection } from '@/lib/reviews/eligibility'
import type { OrderState } from '@/lib/orders'
import { normalizeSizes, type UserSizes } from '@/lib/sizes'
import { DEFAULT_PREFS } from '@/lib/notify/prefs'
import type { NotificationPrefs } from '@/lib/notify/types'
import { publicImages } from '@/lib/listings/images'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export type SettingsAddress = {
  id: string
  name: string
  street1: string
  street2: string | null
  city: string
  state: string
  zip: string
  country: string
  is_default: boolean
  created_at: string
}

export type SettingsOrderRow = {
  id: string
  role: 'buyer' | 'seller'
  state: string
  brand: string
  title: string
  size: string
  image: string | null
  amount: string
  counterparty: string
  created_at: string
  hasTracking: boolean
  canReview: boolean
}

export type ReviewTarget = {
  orderId: string
  brand: string
  title: string
  image: string | null
  amount: string
  deliveredAt: string
  sellerUsername: string
  eligible: boolean
  reason: string | null
}

export interface SettingsData {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  usernameNextChangeAt: number | null
  /** Server-resolved: the 30-day username window is open right now. */
  usernameWindowOpen: boolean
  /** Next quarterly tier review date (ms) — server-resolved. */
  tierReviewDateMs: number
  email: string
  emailVerified: boolean
  memberSince: string
  idVerified: boolean
  sizes: UserSizes
  hideNotMySize: boolean
  addresses: SettingsAddress[]
  payoutsEnabled: boolean
  payoutOnboardingDone: boolean
  prefs: NotificationPrefs
  notificationsEnabled: boolean
  phoneVerificationEnabled: boolean
  phoneVerified: boolean
  phone: string | null
  tierDashboardEnabled: boolean
  buyerTier: SideDashboard | null
  sellerTier: SideDashboard
  welcomeLeft: number
  salesCount: number
  reviewsEnabled: boolean
  shippingLabelsEnabled: boolean
  orders: SettingsOrderRow[]
  review: ReviewTarget | null
}

export type SettingsBundle = {
  data: SettingsData
  /** Orders in an active state (rail badge "n ACTIVE"). */
  activeOrders: number
}

const ACTIVE_ORDER_STATES = ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed']
const ORDER_COLS = 'id, listing_id, buyer_id, seller_id, state, total_cents, transfer_cents, created_at, tracking_number, delivered_at, released_at'

type OrderRowRaw = {
  id: string; listing_id: string; buyer_id: string; seller_id: string; state: string
  total_cents: number; transfer_cents: number; created_at: string; tracking_number: string | null
  delivered_at: string | null; released_at: string | null
}

/** Buyer + seller order rows for ORDERS (merged, newest first). */
export async function loadSettingsOrders(opts: { supabase: Client; user: User }): Promise<SettingsOrderRow[]> {
  const { supabase, user } = opts
  const svc = createServiceClientRaw()
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
  const listingMap = new Map(((listingRows ?? []) as Array<Record<string, unknown>>).map((l) => [l.id as string, l as unknown as { title: string; brand: string; size: string; images: string[] }]))
  const nameMap = new Map(((profileRows ?? []) as Array<Record<string, unknown>>).map((p) => [p.id as string, p.username as string]))
  return all
    .map(({ o, role }) => {
      const l = listingMap.get(o.listing_id)
      return {
        id: o.id,
        role,
        state: o.state,
        brand: l?.brand ?? '',
        title: l?.title ?? 'Unknown',
        size: l?.size ?? '',
        image: publicImages(l?.images)[0] ?? null,
        amount: formatCents(role === 'buyer' ? o.total_cents : o.transfer_cents),
        counterparty: nameMap.get(role === 'buyer' ? o.seller_id : o.buyer_id) ?? (role === 'buyer' ? 'seller' : 'buyer'),
        created_at: o.created_at,
        hasTracking: !!o.tracking_number,
        canReview: REVIEWS_ENABLED && role === 'buyer' && o.state === 'released' && !reviewedOrderIds.has(o.id),
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/** The LEAVE FEEDBACK → target for one order (null when the order is not visible). */
export async function loadReviewTarget(opts: { supabase: Client; user: User; orderId: string }): Promise<ReviewTarget | null> {
  const { supabase, user, orderId } = opts
  const svc = createServiceClientRaw()
  const { data: o } = await supabase.from('orders').select(ORDER_COLS).eq('id', orderId).maybeSingle()
  if (!o) return null
  const row = o as OrderRowRaw
  const [{ data: l }, { data: existing }, { data: seller }] = await Promise.all([
    svc.from('listings').select('title, brand, size, images').eq('id', row.listing_id).maybeSingle(),
    supabase.from('reviews').select('direction').eq('order_id', row.id),
    supabase.from('profiles').select('username').eq('id', row.seller_id).maybeSingle(),
  ])
  const existingDirections = ((existing ?? []) as Array<{ direction: ReviewDirection }>).map((r) => r.direction)
  const elig = canLeaveReview({ buyerId: row.buyer_id, sellerId: row.seller_id, state: row.state as OrderState }, user.id, { existingDirections })
  return {
    orderId: row.id,
    brand: (l?.brand as string) ?? '',
    title: (l?.title as string) ?? 'Unknown',
    image: publicImages(l?.images)[0] ?? null,
    amount: formatCents(row.total_cents),
    deliveredAt: row.delivered_at ?? row.released_at ?? row.created_at,
    sellerUsername: (seller?.username as string) ?? 'seller',
    eligible: REVIEWS_ENABLED && elig.ok,
    reason: elig.ok ? null : elig.reason,
  }
}

export async function loadSettings(opts: {
  supabase: Client
  user: User
  /** ORDERS section rows are only loaded when asked for. */
  includeOrders?: boolean
  /** REVIEW section target (LEAVE FEEDBACK →). */
  reviewOrderId?: string | null
  /** `/settings/payouts?onboarding=complete` after the Stripe return. */
  payoutOnboardingDone?: boolean
}): Promise<SettingsBundle> {
  const { supabase, user, includeOrders = false, reviewOrderId = null, payoutOnboardingDone = false } = opts

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
  const nowMs = Date.now()
  const usernameWindowOpen = usernameNextChangeAt === null || usernameNextChangeAt <= nowMs
  // Next quarterly tier review: first day of the next quarter (UTC).
  const nowD = new Date(nowMs)
  const q = Math.floor(nowD.getUTCMonth() / 3)
  const tierReviewDateMs = Date.UTC(nowD.getUTCFullYear() + (q === 3 ? 1 : 0), ((q + 1) % 4) * 3, 1)

  const [orders, review] = await Promise.all([
    includeOrders ? loadSettingsOrders({ supabase, user }) : Promise.resolve([] as SettingsOrderRow[]),
    reviewOrderId ? loadReviewTarget({ supabase, user, orderId: reviewOrderId }) : Promise.resolve(null),
  ])

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

  return { data, activeOrders: activeOrders ?? 0 }
}
