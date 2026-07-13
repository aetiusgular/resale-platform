/**
 * PATCH /api/conversations/[id]/consent
 * Toggle the caller's transcript consent flag.
 * Only flips the column for the calling user (buyer or seller).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { consent?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.consent !== 'boolean') {
    return NextResponse.json({ error: 'consent must be a boolean' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  const { data: conv } = await service
    .from('conversations')
    .select('id, buyer_id, seller_id')
    .eq('id', conversationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  if (conv.buyer_id !== user.id && conv.seller_id !== user.id) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const field = conv.buyer_id === user.id
    ? 'comments_consent_buyer'
    : 'comments_consent_seller'

  const { data: updated, error } = await service
    .from('conversations')
    .update({ [field]: body.consent })
    .eq('id', conversationId)
    .select('id, comments_consent_buyer, comments_consent_seller')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 })
  }

  return NextResponse.json({ conversation: updated })
}
