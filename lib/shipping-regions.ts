/**
 * International shipping regions — PURE, importable from client and server.
 *
 * Two shipping modes exist:
 *   - 'platform' — US seller → US buyer. The price is system-derived (lib/shipping, G11) and
 *     the platform buys the prepaid EasyPost label from it (G12). Sellers never set it.
 *   - 'seller'   — every other lane. The seller sets a flat rate per region on the listing,
 *     buys their own label with any carrier, and the shipping the buyer paid is added to the
 *     seller's payout (lib/fees transferCentsFor). Tracking still flows through EasyPost
 *     trackers so carrier scans can mark the order delivered.
 *
 * Regions depend on where the seller ships from: a US seller prices Canada (the US lane is
 * automatic); a seller anywhere else prices North America (US, Canada, Mexico) instead.
 * Prices are integer cents.
 */
import { isRestrictedCountry, isUS, normalizeCountry } from '@/lib/countries'

export const REGION_KEYS = ['canada', 'north_america', 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other'] as const
export type RegionKey = (typeof REGION_KEYS)[number]

export const REGION_LABELS: Record<RegionKey, string> = {
  canada: 'Canada',
  north_america: 'North America',
  united_kingdom: 'United Kingdom',
  europe: 'Europe',
  asia: 'Asia',
  australia_nz: 'Australia / NZ',
  other: 'Other',
}

/** Largest flat rate a seller can set for one region ($500). */
export const MAX_REGION_RATE_CENTS = 50_000

/** Per-listing rates: only the regions the seller ships to are present. */
export type IntlShipping = Partial<Record<RegionKey, number>>

const NORTH_AMERICA = new Set(['US', 'CA', 'MX'])
const UNITED_KINGDOM = new Set(['GB', 'IM', 'JE', 'GG'])
const EUROPE = new Set([
  'AL', 'AD', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FO', 'FI', 'FR', 'DE', 'GI',
  'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK',
  'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'VA', 'TR',
])
const ASIA = new Set([
  'AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'HK', 'IN', 'ID', 'IQ', 'IL', 'JP',
  'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MO', 'MY', 'MV', 'MN', 'MM', 'NP', 'OM', 'PK', 'PS', 'PH',
  'QA', 'SA', 'SG', 'KR', 'LK', 'TW', 'TJ', 'TH', 'TL', 'TM', 'AE', 'UZ', 'VN', 'YE',
])
const AUSTRALIA_NZ = new Set(['AU', 'NZ'])

/** The regions a seller shipping from `origin` prices, in display order. */
export function regionsForOrigin(origin: string | null | undefined): RegionKey[] {
  const first: RegionKey = isUS(origin) ? 'canada' : 'north_america'
  return [first, 'united_kingdom', 'europe', 'asia', 'australia_nz', 'other']
}

/**
 * Which lane a destination falls in for a seller in `origin`: 'domestic' (US → US, the
 * platform-label lane), a region key, or null when the destination is restricted/unknown.
 */
export function regionForDestination(origin: string | null | undefined, destination: string | null | undefined): RegionKey | 'domestic' | null {
  // Legacy snapshots carry no country: every address before international shipping was US.
  const dest = normalizeCountry(destination || 'US')
  if (!dest || isRestrictedCountry(dest)) return null
  if (isUS(origin)) {
    if (dest === 'US') return 'domestic'
    if (dest === 'CA') return 'canada'
  } else if (NORTH_AMERICA.has(dest)) {
    return 'north_america'
  }
  if (UNITED_KINGDOM.has(dest)) return 'united_kingdom'
  if (EUROPE.has(dest)) return 'europe'
  if (ASIA.has(dest)) return 'asia'
  if (AUSTRALIA_NZ.has(dest)) return 'australia_nz'
  return 'other'
}

/**
 * Validate seller-supplied rates for a listing shipping from `origin`. Unknown keys, keys
 * that don't apply to the origin, and bad amounts are dropped. A Canada rate carried over to
 * a non-US origin (or North America to a US one) is re-keyed so a seller who moves keeps
 * their price. Returns a fresh object in region order.
 */
export function cleanIntlShipping(raw: unknown, origin: string | null | undefined): IntlShipping {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = { ...(raw as Record<string, unknown>) }
  const us = isUS(origin)
  if (us && src.canada === undefined && src.north_america !== undefined) src.canada = src.north_america
  if (!us && src.north_america === undefined && src.canada !== undefined) src.north_america = src.canada
  const out: IntlShipping = {}
  for (const key of regionsForOrigin(origin)) {
    const v = src[key]
    if (v === undefined || v === null || v === '') continue
    // Strings must be whole digits: ' ' or '1e3' never become a price.
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN
    if (!Number.isInteger(n) || n < 0 || n > MAX_REGION_RATE_CENTS) continue
    out[key] = n
  }
  return out
}

export type ShippingQuote =
  | { ok: true; labelMode: 'platform'; region: 'domestic'; cents: number }
  | { ok: true; labelMode: 'seller'; region: RegionKey; cents: number }
  | { ok: false; reason: 'restricted' | 'not_offered'; region: RegionKey | null }

/**
 * Price the shipping line for one destination.
 *  - US → US: the listing's system-derived domestic price ('platform' label). Offer checkouts
 *    keep their existing rule of no domestic shipping line.
 *  - Anything else: the seller's rate for that region ('seller' label), or not_offered.
 *    Offers still pay international shipping — the seller has to buy that label.
 */
export function quoteShipping(input: {
  origin: string | null | undefined
  destination: string | null | undefined
  domesticCents: number
  intl: IntlShipping | null | undefined
  isOffer?: boolean
}): ShippingQuote {
  const region = regionForDestination(input.origin, input.destination)
  if (region === null) return { ok: false, reason: 'restricted', region: null }
  if (region === 'domestic') {
    return { ok: true, labelMode: 'platform', region: 'domestic', cents: input.isOffer ? 0 : Math.max(0, Math.round(input.domesticCents)) }
  }
  const rate = cleanIntlShipping(input.intl ?? {}, input.origin)[region]
  if (rate === undefined) return { ok: false, reason: 'not_offered', region }
  return { ok: true, labelMode: 'seller', region, cents: rate }
}

/** Short summary for the closed shipping dropdown: "5 regions · from $20". */
export function intlSummary(intl: IntlShipping, formatCents: (c: number) => string, origin?: string | null): string {
  const rates = Object.values(intl).filter((v): v is number => typeof v === 'number')
  if (rates.length === 0) return isUS(origin) ? 'US only' : 'No regions yet'
  const min = Math.min(...rates)
  return `${rates.length} ${rates.length === 1 ? 'region' : 'regions'} · from ${min === 0 ? 'free' : formatCents(min)}`
}

/** A seller outside the US has no automatic lane, so a listing needs at least one region. */
export function needsIntlRegion(origin: string | null | undefined, intl: IntlShipping): boolean {
  return !isUS(origin) && Object.keys(intl).length === 0
}
