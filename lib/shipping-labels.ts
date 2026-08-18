/**
 * EasyPost label PURCHASE adapter — SERVER ONLY (G12).
 *
 * Turns the G11 collected shipping (listings.shipping_cents = category floor + $2) into an
 * actual prepaid label: create an EasyPost shipment (from seller, to buyer, category parcel),
 * buy the cheapest enabled GROUND rate, and hand the label back to the seller to print. The
 * platform's single EasyPost account pays; the buyer's pre-collected shipping funds it; the
 * margin is `shipping_cents − rateCents` (labelMarginCents).
 *
 * DORMANT until SHIPPING_LABELS_ENABLED=true AND SHIPPING_PROVIDER_API_KEY is set (see
 * easypostConfigured). Pure helpers below are network-free and unit-tested. The buy/refund/
 * verify calls only fire on the confirmed-sale path when the flag is on. US ground only —
 * international/customs is out of scope for G12.
 */
import crypto from 'node:crypto'
import { easypostConfigured, GROUND_SERVICES } from '@/lib/shipping-easypost'
import type { ParcelPreset } from '@/lib/shipping'

const EASYPOST_API = 'https://api.easypost.com/v2'

/** EasyPost uses HTTP Basic auth: API key as username, empty password. */
function authHeader(): string {
  return 'Basic ' + Buffer.from(`${process.env.SHIPPING_PROVIDER_API_KEY}:`).toString('base64')
}

/** A complete address — a label needs all of these (name + street + city/state/zip). */
export interface LabelAddress {
  name: string
  street1: string
  street2?: string | null
  city: string
  state: string
  zip: string
  country?: string // defaults US
}

export interface BoughtLabel {
  shipmentId: string
  trackerId: string | null
  trackingCode: string | null
  carrier: string | null
  service: string | null
  rateCents: number
  labelUrl: string | null
}

type RawRate = { id?: string | null; service?: string | null; rate?: string | null }

// ─── Pure helpers (network-free, unit-tested) ────────────────────────────────

/** Cheapest enabled-ground rate id + cents from an EasyPost `rates` array, or null. */
export function pickCheapestGroundRate(
  rates: ReadonlyArray<RawRate> | null | undefined,
): { id: string; cents: number } | null {
  const candidates = (rates ?? [])
    .filter((r) => !!r.service && GROUND_SERVICES.has(r.service) && !!r.id)
    .map((r) => ({ id: r.id as string, cents: Math.round(parseFloat(r.rate ?? 'NaN') * 100) }))
    .filter((r) => Number.isFinite(r.cents) && r.cents > 0)
  if (!candidates.length) return null
  return candidates.reduce((a, b) => (b.cents < a.cents ? b : a))
}

/** Platform margin on a label: collected shipping minus the label cost (may be negative). */
export function labelMarginCents(collectedCents: number, labelCostCents: number): number {
  return Math.round(collectedCents) - Math.round(labelCostCents)
}

/** EasyPost parcel from a category preset (weight in OUNCES, dims in inches). */
export function parcelFromPreset(preset: ParcelPreset) {
  return {
    weight: preset.weightOz,
    length: preset.lengthIn,
    width: preset.widthIn,
    height: preset.heightIn,
  }
}

export interface TrackerEvent {
  eventId: string | null
  trackingCode: string | null
  status: string | null
  deliveredAt: string | null
}

/** Parse an EasyPost tracker webhook event → the fields we act on. */
export function parseTrackerEvent(event: unknown): TrackerEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = event as any
  const result = e?.result ?? {}
  const status: string | null = result?.status ?? null
  let deliveredAt: string | null = null
  if (status === 'delivered') {
    const details = Array.isArray(result?.tracking_details) ? result.tracking_details : []
    const last = details.length ? details[details.length - 1] : null
    deliveredAt = last?.datetime ?? result?.updated_at ?? null
  }
  return {
    eventId: e?.id ?? null,
    trackingCode: result?.tracking_code ?? null,
    status,
    deliveredAt,
  }
}

/**
 * Constant-time verify of the EasyPost webhook HMAC. EasyPost sends `X-Hmac-Signature`
 * (commonly `hmac-sha256-hex=<digest>`), an HMAC-SHA256 of the raw body under the webhook
 * secret. NOTE: confirm the exact encoding (incl. unicode NFKD normalization + header prefix)
 * against EasyPost docs before enabling the webhook in production.
 */
export function verifyEasypostSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false
  const provided = header.includes('=') ? header.slice(header.indexOf('=') + 1).trim() : header.trim()
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  if (provided.length !== digest.length) return false
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(digest))
}

// ─── Live EasyPost calls (dormant until easypostConfigured) ───────────────────

/**
 * Create a shipment and buy the cheapest enabled ground label. Returns the bought label or
 * null (unconfigured, no ground rate, or any error). SPENDS money — only call on a confirmed
 * sale. Never throws.
 */
export async function buyShippingLabel(input: {
  from: LabelAddress
  to: LabelAddress
  preset: ParcelPreset
}): Promise<BoughtLabel | null> {
  if (!easypostConfigured()) return null
  try {
    const createRes = await fetch(`${EASYPOST_API}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({
        shipment: {
          to_address: { ...input.to, country: input.to.country ?? 'US' },
          from_address: { ...input.from, country: input.from.country ?? 'US' },
          parcel: parcelFromPreset(input.preset),
        },
      }),
    })
    if (!createRes.ok) return null
    const shipment = (await createRes.json()) as { id?: string; rates?: RawRate[] }
    if (!shipment.id) return null
    const rate = pickCheapestGroundRate(shipment.rates)
    if (!rate) return null

    const buyRes = await fetch(`${EASYPOST_API}/shipments/${shipment.id}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ rate: { id: rate.id } }),
    })
    if (!buyRes.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bought = (await buyRes.json()) as any
    return {
      shipmentId: bought.id ?? shipment.id,
      trackerId: bought.tracker?.id ?? null,
      trackingCode: bought.tracking_code ?? null,
      carrier: bought.selected_rate?.carrier ?? null,
      service: bought.selected_rate?.service ?? null,
      rateCents: Math.round(parseFloat(bought.selected_rate?.rate ?? String(rate.cents / 100)) * 100),
      labelUrl: bought.postage_label?.label_url ?? null,
    }
  } catch {
    return null
  }
}

/** Refund an UNUSED label. Returns true on a successful refund request. Never throws. */
export async function refundShippingLabel(shipmentId: string): Promise<boolean> {
  if (!easypostConfigured() || !shipmentId) return false
  try {
    const res = await fetch(`${EASYPOST_API}/shipments/${shipmentId}/refund`, {
      method: 'POST',
      headers: { Authorization: authHeader() },
    })
    return res.ok
  } catch {
    return false
  }
}

/** EasyPost delivery-address verification. Returns validity + any messages. Never throws. */
export async function verifyAddress(
  addr: LabelAddress,
): Promise<{ valid: boolean; messages: string[] }> {
  if (!easypostConfigured()) return { valid: false, messages: ['unconfigured'] }
  try {
    const res = await fetch(`${EASYPOST_API}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ address: { ...addr, country: addr.country ?? 'US' }, verify: ['delivery'] }),
    })
    if (!res.ok) return { valid: false, messages: ['request_failed'] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any
    const v = data?.verifications?.delivery
    const messages = Array.isArray(v?.errors) ? v.errors.map((e: { message?: string }) => e.message ?? '') : []
    return { valid: !!v?.success, messages }
  } catch {
    return { valid: false, messages: ['exception'] }
  }
}
