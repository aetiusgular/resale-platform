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
