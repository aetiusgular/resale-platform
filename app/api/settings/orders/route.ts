/**
 * GET /api/settings/orders — the ORDERS section rows (purchases + sales, newest first), same
 * assembly as /settings/orders (lib/loaders/settings#loadSettingsOrders).
 */
import { requireUser } from '@/lib/supabase/server'
import { loadSettingsOrders } from '@/lib/loaders/settings'
import { respond } from '@/lib/api/respond'

export async function GET() {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    return { orders: await loadSettingsOrders({ supabase, user }) }
  })
}
