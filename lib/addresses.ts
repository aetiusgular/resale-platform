/**
 * Address book validation — PURE. One shape for the addresses table, the
 * profiles.shipping_address mirror and the checkout form.
 */
export interface AddressInput {
  name: string
  street1: string
  street2: string | null
  city: string
  state: string
  zip: string
  country: 'US'
}

export interface AddressRow extends AddressInput {
  id: string
  is_default: boolean
  created_at: string
}

const US_STATE_RE = /^[A-Z]{2}$/
const ZIP_RE = /^\d{5}(-\d{4})?$/

export function cleanAddress(raw: unknown): { address: AddressInput } | { error: string } {
  const a = (raw ?? {}) as Record<string, unknown>
  const s = (k: string, max: number) => String(a[k] ?? '').trim().slice(0, max)
  const address: AddressInput = {
    name: s('name', 100),
    street1: s('street1', 200),
    street2: s('street2', 200) || null,
    city: s('city', 100),
    state: s('state', 50).toUpperCase(),
    zip: s('zip', 20),
    country: 'US',
  }
  if (!address.name) return { error: 'Name on the label is required.' }
  if (!address.street1) return { error: 'Street address is required.' }
  if (!address.city) return { error: 'City is required.' }
  if (!US_STATE_RE.test(address.state)) return { error: 'State must be a two-letter code (e.g. NY).' }
  if (!ZIP_RE.test(address.zip)) return { error: 'ZIP must be 5 digits (or ZIP+4).' }
  return { address }
}

/** Display lines for an address card: street (+ unit) / city, ST zip / United States. */
export function addressLines(a: Pick<AddressInput, 'street1' | 'street2' | 'city' | 'state' | 'zip'>): string[] {
  return [
    a.street2 ? `${a.street1}, ${a.street2}` : a.street1,
    `${a.city}, ${a.state} ${a.zip}`,
    'United States',
  ]
}

/**
 * Order ship-to snapshot as stored on orders.ship_to_address / orders.shipping_address
 * (JSON copied from profiles.shipping_address at payment time). Current rows use the
 * address-book keys; rows written by the pre-2026-09 checkout form or onboarding
 * quick_setup used free-text keys, which normalizeShipTo() maps.
 */
export type ShipToAddress = {
  name?: string | null
  street1?: string | null
  street2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  // Legacy free-text keys.
  fullName?: string | null
  street?: string | null
  apt?: string | null
  stateZip?: string | null
}

/** Address-book shape from either the current snapshot or the legacy free-text keys. */
export function normalizeShipTo(a: ShipToAddress | null | undefined): ShipToAddress | null {
  if (!a) return null
  const legacy = (a.stateZip ?? '').trim().split(/\s+/)
  return {
    name: a.name ?? a.fullName ?? null,
    street1: a.street1 ?? a.street ?? null,
    street2: a.street2 ?? a.apt ?? null,
    city: a.city ?? null,
    state: a.state ?? (legacy.length === 2 ? legacy[0] : null),
    zip: a.zip ?? (legacy.length === 2 ? legacy[1] : null),
    country: a.country ?? 'US',
  }
}

/** True when the snapshot has everything a seller needs to address a parcel. */
export function isShippable(a: ShipToAddress | null | undefined): a is ShipToAddress & { street1: string; city: string; state: string; zip: string } {
  const n = normalizeShipTo(a)
  return !!(n && n.street1 && n.city && n.state && n.zip)
}
