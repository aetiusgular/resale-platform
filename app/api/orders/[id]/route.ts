/**
 * GET /api/orders/[id] — order detail for a party (or admin), the same assembly as /orders/[id]
 * (lib/loaders/order) plus the `actions` the viewer may take and the escrow timers.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadOrderDetail } from '@/lib/loaders/order'
import { ApiError, respond } from '@/lib/api/respond'

interface Ctx { params: Promise<{ id: string }> }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params
    if (!UUID_RE.test(id)) throw new ApiError(400, 'Invalid order id')
    const { supabase, user } = await requireUser()
    const order = await loadOrderDetail({ supabase, user, id })
    if (!order) throw new ApiError(404, 'Not found')
    return order
  })
}
