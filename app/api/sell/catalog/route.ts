/**
 * GET /api/sell/catalog — the seller's catalog (ACTIVE / DRAFTS / SOLD) with offers, payouts and
 * the fee line, same assembly as /sell (lib/loaders/sell#loadSellCatalog).
 */
import { requireUser } from '@/lib/supabase/server'
import { loadSellCatalog } from '@/lib/loaders/sell'
import { respond } from '@/lib/api/respond'

export async function GET() {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    return loadSellCatalog({ supabase, user })
  })
}
