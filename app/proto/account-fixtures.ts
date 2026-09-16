/**
 * Fixture data for the signed-in proto surfaces: SAVED, SELL, SETTINGS / ORDERS.
 *
 * Derived from the same PROTO_LISTINGS catalog the proto browse grid uses, shaped
 * into the exact loader types the real pages take, so `/styleguide/proto/*` mounts
 * the REAL components (SavedClient, SellCatalog, SettingsSections) with no live
 * query and no session. Nothing here is read by any real route.
 *
 * Feature flags are fixed literals here, NOT reads of lib/flags: this module is
 * imported by client components, where a server-only env flag inlines as false and
 * disagrees with the server render. They are all on so the tour can show each
 * signed-in surface fully built rather than as a "SOON" placeholder.
 */
import type { FollowedSeller, SavedListing, SavedSearchRow } from '@/lib/loaders/saved'
import type { ListingInitial, SellerListing } from '@/lib/loaders/sell'
import type { SettingsData, SettingsOrderRow } from '@/lib/loaders/settings'
import type { SideDashboard } from '@/lib/tier-dashboard'
import { formatCents } from '@/lib/fees'
import { DEFAULT_PREFS } from '@/lib/notify/prefs'
import { sizeKey } from '@/lib/sizes'
import { PROTO_LISTINGS, type ProtoListing } from './fixtures'
import { PROTO_VIEWER } from './viewer-fixture'

export const PROTO_FLAGS = { follows: true, alerts: true, bump: true, boost: true }

const byId = (id: string): ProtoListing => {
  const l = PROTO_LISTINGS.find((x) => x.id === id)
  if (!l) throw new Error(`proto fixture missing: ${id}`)
  return l
}

// ── SAVED ────────────────────────────────────────────────────────────────────

function savedFrom(id: string, savedAt: string, priceAtSave: number | null): SavedListing {
  const l = byId(id)
  return {
    id: l.id,
    title: l.title,
    brand: l.brand,
    category: l.category,
    department: l.department,
    size: l.size,
    condition_score: l.condition_score,
    price_cents: l.price_cents,
    saves_count: l.saves_count,
    is_price_dropped: l.is_price_dropped,
    images: [],
    created_at: l.created_at,
    status: l.sold ? 'sold' : 'active',
    seller: { username: l.seller_handle, id_verification_status: 'verified' },
    original_price_cents: l.original_price_cents,
    price_display: l.price_display,
    saved_at: savedAt,
    price_at_save: priceAtSave,
  }
}

export const PROTO_SAVED_LISTINGS: SavedListing[] = [
  savedFrom('proto-01', '2026-09-13T19:00:00.000Z', 185000),
  savedFrom('proto-06', '2026-09-11T10:00:00.000Z', 19000),
  savedFrom('proto-09', '2026-09-10T08:30:00.000Z', 34000),
  savedFrom('proto-03', '2026-09-08T21:15:00.000Z', 62000),
  savedFrom('proto-07', '2026-09-07T13:00:00.000Z', 14500),
  savedFrom('proto-10', '2026-09-02T16:45:00.000Z', 11000),
]

export const PROTO_SAVED_SEARCHES: SavedSearchRow[] = [
  {
    id: 'ps1',
    query: { q: 'lemaire', dept: 'womens', cat: 'Bottoms', max_price: '400' },
    created_at: '2026-08-21T12:00:00.000Z',
    alerts_enabled: true,
    new_count: 3,
  },
  {
    id: 'ps2',
    query: { dept: 'mens', cat: 'Outerwear', size: 'm', cond: '8' },
    created_at: '2026-08-04T09:00:00.000Z',
    alerts_enabled: false,
    new_count: 0,
  },
  {
    id: 'ps3',
    query: { brand: 'the row', authenticated: '1' },
    created_at: '2026-07-19T17:30:00.000Z',
    alerts_enabled: true,
    new_count: 11,
  },
]

export const PROTO_FOLLOWED_SELLERS: FollowedSeller[] = [
  { id: 'fs1', username: 'atelier.east', verified: true, followed_at: '2026-06-02T10:00:00.000Z', active_listings: 34, rating: 4.9, new_this_week: 2 },
  { id: 'fs2', username: 'studio.north', verified: true, followed_at: '2026-07-14T10:00:00.000Z', active_listings: 18, rating: 4.8, new_this_week: 0 },
  { id: 'fs3', username: 'rail.west', verified: true, followed_at: '2026-08-30T10:00:00.000Z', active_listings: 7, rating: 4.6, new_this_week: 1 },
]

export const PROTO_SINCE_VISIT = { drops: 1, sold: 1, hadVisit: true }

// ── SELL ─────────────────────────────────────────────────────────────────────

type SellSeed = {
  id: string
  status: SellerListing['status']
  view_count?: number
  open_offers?: number
  top_offer_cents?: number | null
  photo_count?: number
  bumped_at?: string | null
  sold_at?: string
  payout_cents?: number | null
  order_id?: string | null
  rejection_reason?: string | null
}

function sellerFrom(seed: SellSeed): SellerListing {
  const l = byId(seed.id)
  return {
    id: l.id,
    title: l.title,
    brand: l.brand,
    size: l.size,
    price_cents: l.price_cents,
    price_display: l.price_display,
    status: seed.status,
    image: null,
    photo_count: seed.photo_count ?? 6,
    created_at: l.created_at,
    updated_at: l.created_at,
    saves_count: l.saves_count,
    view_count: seed.view_count ?? 0,
    boosted: false,
    boosted_until: null,
    bumped_at: seed.bumped_at ?? null,
    rejection_reason: seed.rejection_reason ?? null,
    open_offers: seed.open_offers ?? 0,
    top_offer_display: seed.top_offer_cents != null ? formatCents(seed.top_offer_cents) : null,
    sold_at: seed.sold_at ?? l.created_at,
    payout_display: seed.payout_cents != null ? formatCents(seed.payout_cents) : null,
    order_id: seed.order_id ?? null,
  }
}

export const PROTO_SELLER_LISTINGS: SellerListing[] = [
  sellerFrom({ id: 'proto-05', status: 'active', view_count: 214, open_offers: 1, top_offer_cents: 24000, bumped_at: '2026-09-12T09:00:00.000Z' }),
  sellerFrom({ id: 'proto-07', status: 'active', view_count: 96 }),
  sellerFrom({ id: 'proto-09', status: 'pending_review', view_count: 4 }),
  sellerFrom({ id: 'proto-02', status: 'draft', photo_count: 3 }),
  sellerFrom({ id: 'proto-10', status: 'sold', view_count: 401, sold_at: '2026-08-12T00:00:00.000Z', payout_cents: 37300, order_id: 'po-1' }),
]

/** Matches the 900bps sellerTier below, so /sell and /settings agree. */
export const PROTO_FEE_LINE = 'TIER 5 — 9.0% FEE'

/** Prefill for the proto create wizard (`?draft=`-style partial listing). */
export const PROTO_DRAFT: ListingInitial = {
  id: 'proto-draft',
  status: 'draft',
  title: 'Five-pocket raw denim jean',
  brand: "Levi's",
  category: 'Bottoms',
  department: 'menswear',
  subcategory: 'Denim',
  size: '32',
  color: 'Navy',
  description: 'Prototype draft — unsanforized denim, hemmed. Fixture data only.',
  condition_score: 8,
  price_cents: null,
  images: [],
  possession_photo_url: null,
  measurements: { WAIST: 16, INSEAM: 31 },
}

// ── SETTINGS / ORDERS ────────────────────────────────────────────────────────

const ORDERS: SettingsOrderRow[] = [
  {
    id: 'po-1', role: 'seller', state: 'shipped', brand: 'Barbour', title: 'Waxed cotton field jacket',
    size: '38', image: null, amount: '$110', counterparty: 'loft.sale',
    created_at: '2026-09-10T12:00:00.000Z', hasTracking: true, canReview: false,
  },
  {
    id: 'po-2', role: 'buyer', state: 'delivered', brand: 'Maison Margiela', title: 'Tabi leather ankle boot',
    size: '38', image: null, amount: '$620', counterparty: 'studio.north',
    created_at: '2026-09-04T12:00:00.000Z', hasTracking: true, canReview: true,
  },
  {
    id: 'po-3', role: 'buyer', state: 'paid_held', brand: 'Khaite', title: 'Cashmere crew sweater',
    size: 'XS', image: null, amount: '$340', counterparty: 'atelier.east',
    created_at: '2026-09-13T12:00:00.000Z', hasTracking: false, canReview: false,
  },
  {
    id: 'po-4', role: 'seller', state: 'released', brand: 'Champion', title: 'Crewneck heavyweight sweatshirt',
    size: 'L', image: null, amount: '$45', counterparty: 'rail.west',
    created_at: '2026-07-28T12:00:00.000Z', hasTracking: true, canReview: false,
  },
]

export const PROTO_ACTIVE_ORDERS = ORDERS.filter((o) =>
  ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed'].includes(o.state),
).length

const sellerTier: SideDashboard = {
  side: 'seller',
  volumeCents: 480000,
  orderCount: 21,
  activityBps: 900,
  effectiveBps: 900,
  locked: false,
  lockedUntilMs: null,
  current: { minVolumeCents: 250000, minOrders: 10, bps: 900 },
  next: { minVolumeCents: 1000000, minOrders: 40, bps: 800 },
  volumeToNextCents: 520000,
  ordersToNext: 19,
  expiringVolumeCents: 62000,
  expiringOrderCount: 2,
  projectedBps: 900,
  willDropTier: false,
}

export const PROTO_SETTINGS: SettingsData = {
  userId: 'proto-user',
  username: PROTO_VIEWER.username,
  displayName: PROTO_VIEWER.displayName,
  avatarUrl: null,
  usernameNextChangeAt: null,
  usernameWindowOpen: true,
  tierReviewDateMs: Date.UTC(2026, 11, 31),
  email: 'tony@example.com',
  emailVerified: true,
  memberSince: 'MAR 2025',
  idVerified: true,
  sizes: {
    [sizeKey('menswear', 'tops')]: ['M', 'L'],
    [sizeKey('menswear', 'bottoms')]: ['32'],
    [sizeKey('menswear', 'footwear')]: ['10.5'],
  },
  hideNotMySize: false,
  addresses: [
    {
      id: 'pa1', name: 'Tony Field', street1: '114 Rivington St', street2: 'Apt 3R',
      city: 'New York', state: 'NY', zip: '10002', country: 'US',
      is_default: true, created_at: '2026-03-04T12:00:00.000Z',
    },
    {
      id: 'pa2', name: 'Tony Field', street1: '900 Hayes St', street2: null,
      city: 'San Francisco', state: 'CA', zip: '94117', country: 'US',
      is_default: false, created_at: '2026-06-18T12:00:00.000Z',
    },
  ],
  payoutsEnabled: true,
  payoutOnboardingDone: true,
  prefs: DEFAULT_PREFS,
  notificationsEnabled: true,
  phoneVerificationEnabled: true,
  phoneVerified: true,
  phone: '+1 (212) 555-0148',
  tierDashboardEnabled: true,
  buyerTier: null,
  sellerTier,
  welcomeLeft: 0,
  salesCount: 21,
  reviewsEnabled: true,
  shippingLabelsEnabled: true,
  orders: ORDERS,
  review: null,
}
