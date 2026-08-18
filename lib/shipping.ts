/**
 * Shipping price engine — single source of truth for system-set shipping.
 *
 * G11: sellers do NOT choose shipping. The buyer-visible shipping price is derived
 * from the listing category at listing-create time and snapshotted onto the order.
 *
 *   displayShipping = max( EasyPost worst-realistic-zone quote , category floor ) + $2 margin
 *
 * The +$2 margin (SHIPPING_MARGIN_CENTS) is what funds the ~$2/active-seller/month
 * Stripe Connect cost on EVERY sale — it replaces the deleted flat monthly fee. Because
 * the real label is bought for the actual (nearer) zone at fulfillment, the platform keeps
 * the spread; the margin is the guaranteed floor of that spread.
 *
 * This module is PURE and dependency-free. The live EasyPost call is injected as a
 * `ParcelRater` by the listing route (server-only, needs the API key) so the pricing
 * math here stays unit-testable with no network. Prices are integer cents throughout.
 */

/** The ten listing categories (mirror app/sell/sell-form.tsx CATEGORIES). */
export const SHIPPING_CATEGORIES = [
  'Outerwear', 'Tops', 'Bottoms', 'Footwear', 'Accessories',
  'Knitwear', 'Denim', 'Tailoring', 'Sportswear', 'Other',
] as const
export type ShippingCategory = (typeof SHIPPING_CATEGORIES)[number]

/** Flat margin baked into every shipping price. Funds the Connect per-seller cost. */
export const SHIPPING_MARGIN_CENTS = 200

/** Provenance of a resolved shipping price (audit / telemetry). */
export type ShippingSource = 'preset' | 'quote'

export interface ParcelPreset {
  /** Packed weight in OUNCES (EasyPost parcels are specified in oz). */
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
  /** Category floor in cents, BEFORE the margin. displayShipping never drops below this + margin. */
  floorCents: number
}

/**
 * Worst-case parcel presets (biased heavy; refine from real shipment data later).
 * Weights: Tops 1lb·Sportswear/Knitwear 3lb·Bottoms/Denim 2lb·Tailoring/Footwear/Accessories 5lb·
 * Outerwear/Other 6lb. Floors honor the user-set minimums (Tops $7, Footwear $20, Outerwear $15).
 */
export const SHIPPING_PRESETS: Record<ShippingCategory, ParcelPreset> = {
  Tops:        { weightOz: 16, lengthIn: 12, widthIn: 9,  heightIn: 3, floorCents:  700 },
  Sportswear:  { weightOz: 48, lengthIn: 15, widthIn: 12, heightIn: 4, floorCents:  800 },
  Bottoms:     { weightOz: 32, lengthIn: 14, widthIn: 11, heightIn: 3, floorCents:  900 },
  Denim:       { weightOz: 32, lengthIn: 14, widthIn: 11, heightIn: 3, floorCents: 1000 },
  Knitwear:    { weightOz: 48, lengthIn: 15, widthIn: 12, heightIn: 4, floorCents: 1100 },
  Accessories: { weightOz: 80, lengthIn: 16, widthIn: 12, heightIn: 8, floorCents: 1200 },
  Tailoring:   { weightOz: 80, lengthIn: 20, widthIn: 16, heightIn: 6, floorCents: 1400 },
  Outerwear:   { weightOz: 96, lengthIn: 20, widthIn: 16, heightIn: 6, floorCents: 1500 },
  Footwear:    { weightOz: 80, lengthIn: 15, widthIn: 11, heightIn: 7, floorCents: 2000 },
  Other:       { weightOz: 96, lengthIn: 18, widthIn: 14, heightIn: 8, floorCents: 2000 },
}

/** The catch-all preset used for any unrecognized category string. */
const FALLBACK_CATEGORY: ShippingCategory = 'Other'

/** Preset for a category, falling back to the Other ceiling for unknown input. */
export function presetFor(category: string): ParcelPreset {
  return SHIPPING_PRESETS[category as ShippingCategory] ?? SHIPPING_PRESETS[FALLBACK_CATEGORY]
}

export interface ResolvedShipping {
  cents: number
  source: ShippingSource
}

/**
 * Pure pricing rule: displayShipping = max(quote, floor) + margin.
 * A missing / non-positive / non-finite quote falls back to the floor (source 'preset').
 * A usable live quote yields source 'quote'. Always >= floor + margin.
 */
export function resolveShippingCents(
  category: string,
  liveQuoteCents: number | null | undefined,
): ResolvedShipping {
  const preset = presetFor(category)
  const hasQuote =
    typeof liveQuoteCents === 'number' && Number.isFinite(liveQuoteCents) && liveQuoteCents > 0
  const base = hasQuote ? Math.max(Math.round(liveQuoteCents as number), preset.floorCents) : preset.floorCents
  return { cents: base + SHIPPING_MARGIN_CENTS, source: hasQuote ? 'quote' : 'preset' }
}

/** The no-quote price (floor + margin) — the fail-soft value when EasyPost is unavailable. */
export function floorShippingCents(category: string): number {
  return presetFor(category).floorCents + SHIPPING_MARGIN_CENTS
}

/**
 * Live rater signature. The listing route injects an EasyPost-backed implementation that
 * takes the category's parcel preset + the seller's ship-from address, rates the cheaper of
 * the enabled ground carriers at the worst realistic destination zone, and returns the
 * cheapest rate in cents (or null on any failure). Kept as a param so this module has no
 * network dependency and stays unit-testable.
 */
export type ParcelRater = (preset: ParcelPreset, category: string) => Promise<number | null>

/**
 * Resolve shipping for a listing using an injected live rater, failing soft to the floor.
 * Never throws — a rater error becomes a 'preset' price so listing creation is never blocked.
 */
export async function quoteShippingCents(category: string, rater: ParcelRater): Promise<ResolvedShipping> {
  let quote: number | null = null
  try {
    quote = await rater(presetFor(category), category)
  } catch {
    quote = null
  }
  return resolveShippingCents(category, quote)
}

/**
 * TODO (G11 open decision #2, deferred): signature-confirmation surcharge on high-value
 * items (Grailed adds this over ~$750). NOT wired in v1 — kept here as a documented hook so
 * the threshold + amount live in one place when we turn it on. To enable, add the surcharge
 * to the resolved shipping in the listing route (not here) so the pure math stays quote-only.
 */
export const SIGNATURE_CONFIRMATION = {
  enabled: false,
  thresholdCents: 75_000, // items > $750
  surchargeCents: 400,    // +$4
} as const
