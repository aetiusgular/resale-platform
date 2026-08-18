/**
 * EasyPost live shipping rater — SERVER ONLY.
 *
 * DORMANT until SHIPPING_LABELS_ENABLED=true AND SHIPPING_PROVIDER_API_KEY is set. Until
 * then `makeEasypostRater` returns a rater that yields null, so lib/shipping.ts falls back
 * to the category floor + $2 margin (source 'preset'). This mirrors how the repo treats all
 * shipping-label infra (flagged off) — G11 ships the pricing ENGINE live and the live-rating
 * path ready-but-dormant.
 *
 * When enabled: rates a category parcel preset from the seller's ship-from ZIP to a fixed
 * worst-realistic domestic destination, across the enabled GROUND services only, and returns
 * the cheapest rate in integer cents (or null on any error). Rating is free — we never buy a
 * label here. Uses the EasyPost REST API via global fetch (no SDK dependency).
 */
import { SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import type { ParcelPreset, ParcelRater } from '@/lib/shipping'

const EASYPOST_SHIPMENTS_URL = 'https://api.easypost.com/v2/shipments'

/**
 * Worst realistic CONUS destination for the "worst-zone" quote. A far ZIP maximizes the
 * ground zone from most sellers so the quoted price is a safe ceiling (the real label,
 * bought for the actual nearer buyer at fulfillment, costs <= this). Refine per-region from
 * real shipment data later.
 */
export const WORST_ZONE_DEST_ZIP = '98109' // Seattle, WA — far NW corner of CONUS

/** Ground services we quote against (cheapest wins). No expedited/air. */
export const GROUND_SERVICES = new Set(['GroundAdvantage', 'Ground', 'UPSGround', 'SurePost'])

/** True only when the flag is on and a provider key is present. */
export function easypostConfigured(): boolean {
  return SHIPPING_LABELS_ENABLED && !!process.env.SHIPPING_PROVIDER_API_KEY
}

/**
 * Pure: cheapest enabled-ground rate (in cents) from an EasyPost `rates` array, or null.
 * Extracted so the selection logic is unit-testable without a live API call.
 */
export function parseCheapestGroundCents(
  rates: ReadonlyArray<{ service?: string | null; rate?: string | null }> | null | undefined,
): number | null {
  const cents = (rates ?? [])
    .filter((r) => !!r.service && GROUND_SERVICES.has(r.service))
    .map((r) => Math.round(parseFloat(r.rate ?? 'NaN') * 100))
    .filter((c) => Number.isFinite(c) && c > 0)
  return cents.length ? Math.min(...cents) : null
}

/**
 * Build a ParcelRater bound to the seller's ship-from ZIP. Returns null (→ floor price) when
 * shipping labels are disabled, no key is configured, or no from-ZIP is known.
 */
export function makeEasypostRater(fromZip: string | null | undefined): ParcelRater {
  return async (preset: ParcelPreset): Promise<number | null> => {
    if (!easypostConfigured() || !fromZip) return null
    try {
      const res = await fetch(EASYPOST_SHIPMENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SHIPPING_PROVIDER_API_KEY}`,
        },
        body: JSON.stringify({
          shipment: {
            to_address: { zip: WORST_ZONE_DEST_ZIP, country: 'US' },
            from_address: { zip: fromZip, country: 'US' },
            parcel: {
              weight: preset.weightOz,     // ounces
              length: preset.lengthIn,
              width: preset.widthIn,
              height: preset.heightIn,
            },
          },
        }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { rates?: Array<{ service?: string; rate?: string }> }
      return parseCheapestGroundCents(data.rates)
    } catch {
      return null
    }
  }
}
