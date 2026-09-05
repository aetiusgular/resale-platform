/**
 * GET /api/conversations/[id] — the thread bundle /messages/[id] renders from
 * (lib/loaders/thread): conversation, listing snapshot, both parties, messages, offers, order
 * events. Does not move the read cursor — call POST /api/conversations/[id]/read after rendering.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadThread } from '@/lib/loaders/thread'
import { ApiError, respond } from '@/lib/api/respond'

interface Ctx { params: Promise<{ id: string }> }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params
    if (!UUID_RE.test(id)) throw new ApiError(400, 'Invalid conversation id')
    const { supabase, user } = await requireUser()
    const thread = await loadThread({ supabase, user, conversationId: id })
    if (!thread) throw new ApiError(404, 'Not found')
    return thread
  })
}
