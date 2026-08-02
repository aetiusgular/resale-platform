/**
 * Ban check — SERVER ONLY. Enforcement of the G6 ban action lives in three places:
 *   1. middleware.ts — redirects banned users off pages to /banned (and at login).
 *   2. assertNotBanned-style guards on sensitive API write routes (immediate blocking of
 *      money/content actions even for an existing session, which middleware skips for /api).
 * FAIL-OPEN to false on a read error: a transient DB blip must not lock the whole app out;
 * bans are rare and the audit + admin console make a missed check recoverable.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export async function isBanned(service: ServiceClient, userId: string): Promise<boolean> {
  try {
    const { data } = await service.from('profiles').select('banned').eq('id', userId).single()
    return (data as { banned?: boolean } | null)?.banned === true
  } catch {
    return false
  }
}
