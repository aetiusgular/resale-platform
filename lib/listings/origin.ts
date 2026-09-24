/**
 * Where a seller ships from — SERVER ONLY. The seller's default address (mirrored into
 * profiles.ship_from_address by the address-book trigger) decides their country; no address
 * yet means US, which is where every account started before international shipping.
 *
 * profiles.ship_from_address is service-role only (migration 0044), so this reads through
 * the service client scoped to the one seller id it is given.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { DEFAULT_COUNTRY } from '@/lib/countries'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export interface ShipFrom {
  /** ISO country code as stored (may be unsupported/restricted: callers check); 'US' when the seller has no address yet. */
  country: string
  /** Postal code for EasyPost's worst-zone quote (US sellers), else null. */
  zip: string | null
}

export async function sellerShipFrom(service: ServiceClient, sellerId: string): Promise<ShipFrom> {
  const { data } = await service.from('profiles').select('ship_from_address').eq('id', sellerId).maybeSingle()
  const addr = (data?.ship_from_address ?? null) as { country?: string | null; zip?: string | null } | null
  const raw = (addr?.country ?? '').trim().toUpperCase()
  const country = /^[A-Z]{2}$/.test(raw) ? raw : DEFAULT_COUNTRY
  const zip = typeof addr?.zip === 'string' && addr.zip.trim() ? addr.zip.trim() : null
  return { country, zip }
}

export async function sellerOrigin(service: ServiceClient, sellerId: string): Promise<string> {
  return (await sellerShipFrom(service, sellerId)).country
}
