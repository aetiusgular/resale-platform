/**
 * Address book validation — PURE. One shape for the addresses table, the
 * profiles.shipping_address mirror and the checkout form.
 *
 * International: every address carries an ISO country (lib/countries). US, Canada, the UK
 * and Australia get strict state / postal-code checks; elsewhere the region and postal code
 * are optional free text (many countries have neither). Restricted destinations are refused.
 */
import { countryName, DEFAULT_COUNTRY, isRestrictedCountry, normalizeCountry } from '@/lib/countries'

export interface AddressInput {
  name: string
  street1: string
  street2: string | null
  city: string
  /** Two-letter state / province where the country uses one; '' when it doesn't. */
  state: string
  /** ZIP / postal code; '' when the country has none. */
  zip: string
  /** ISO 3166-1 alpha-2. */
  country: string
}

export interface AddressRow extends AddressInput {
  id: string
  is_default: boolean
  created_at: string
}

type CountryRule = { postal: RegExp; postalError: string; state?: RegExp; stateError?: string }

const RULES: Record<string, CountryRule> = {
  US: { postal: /^\d{5}(-\d{4})?$/, postalError: 'ZIP must be 5 digits (or ZIP+4).', state: /^[A-Z]{2}$/, stateError: 'State must be a two-letter code (e.g. NY).' },
  CA: { postal: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, postalError: 'Postal code must look like K1A 0B1.', state: /^[A-Z]{2}$/, stateError: 'Province must be a two-letter code (e.g. ON).' },
  GB: { postal: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, postalError: 'Enter a valid UK postcode (e.g. SW1A 1AA).' },
  AU: { postal: /^\d{4}$/, postalError: 'Postcode must be 4 digits.', state: /^[A-Z]{2,3}$/, stateError: 'State must be a code like NSW or VIC.' },
}
const LOOSE_POSTAL = /^[A-Z0-9][A-Z0-9 -]{1,11}$/

/** Field label for the state / province input. */
export function regionFieldLabel(country: string | null | undefined): string {
  const c = (country || DEFAULT_COUNTRY).toUpperCase()
  return c === 'US' || c === 'AU' ? 'STATE' : c === 'CA' ? 'PROVINCE' : 'REGION'
}

/** Field label for the postal code input. */
export function postalFieldLabel(country: string | null | undefined): string {
  const c = (country || DEFAULT_COUNTRY).toUpperCase()
  return c === 'US' ? 'ZIP' : c === 'GB' || c === 'AU' ? 'POSTCODE' : 'POSTAL CODE'
}

/** True when the country needs a state/province (US, CA, AU). */
export function regionRequired(country: string | null | undefined): boolean {
  return !!RULES[(country || DEFAULT_COUNTRY).toUpperCase()]?.state
}

export function cleanAddress(raw: unknown): { address: AddressInput } | { error: string } {
  const a = (raw ?? {}) as Record<string, unknown>
  const s = (k: string, max: number) => String(a[k] ?? '').trim().slice(0, max)
  const rawCountry = s('country', 2)
  const country = rawCountry ? normalizeCountry(rawCountry) : DEFAULT_COUNTRY
  if (!country) return { error: 'Choose a country.' }
  if (isRestrictedCountry(country)) return { error: `We can’t ship to or from ${countryName(country)}.` }
  const rule = RULES[country]
  const address: AddressInput = {
    name: s('name', 100),
    street1: s('street1', 200),
    street2: s('street2', 200) || null,
    city: s('city', 100),
    state: s('state', 50).toUpperCase(),
    zip: s('zip', 20).toUpperCase(),
    country,
  }
  if (!address.name) return { error: 'Name on the label is required.' }
  if (!address.street1) return { error: 'Street address is required.' }
  if (!address.city) return { error: 'City is required.' }
  if (rule?.state && !rule.state.test(address.state)) return { error: rule.stateError ?? 'State is required.' }
  if (rule) {
    if (!rule.postal.test(address.zip)) return { error: rule.postalError }
  } else if (address.zip && !LOOSE_POSTAL.test(address.zip)) {
    return { error: 'Postal code can only use letters, numbers, spaces and dashes.' }
  }
  return { address }
}

/** Display lines for an address card: street (+ unit) / city, region postal / country. */
export function addressLines(a: Pick<AddressInput, 'street1' | 'street2' | 'city' | 'state' | 'zip'> & { country?: string | null }): string[] {
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [
    a.street2 ? `${a.street1}, ${a.street2}` : a.street1,
    cityLine,
    countryName(a.country),
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
    country: a.country || DEFAULT_COUNTRY,
  }
}

/** True when the snapshot has everything a seller needs to address a parcel. */
export function isShippable(a: ShipToAddress | null | undefined): a is ShipToAddress & { street1: string; city: string } {
  const n = normalizeShipTo(a)
  if (!n || !n.street1 || !n.city) return false
  const rule = RULES[(n.country || DEFAULT_COUNTRY).toUpperCase()]
  if (rule?.state && !n.state) return false
  if (rule && !n.zip) return false
  return true
}
