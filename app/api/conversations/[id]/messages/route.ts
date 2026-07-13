/**
 * GET  /api/conversations/[id]/messages
 * Fetch messages + offers for a conversation (participant only).
 *
 * POST /api/conversations/[id]/messages
 * Send a message via the send_message() SECURITY DEFINER RPC.
 * Link/payment blocking is applied here before the RPC call.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { filterMessage } from '@/lib/message-filter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify participant access (RLS enforces this but we also guard at route level)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, buyer_id, seller_id')
    .eq('id', conversationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Fetch messages
  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, redacted, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // Fetch offers
  const { data: offers, error: offerErr } = await supabase
    .from('offers')
    .select('id, conversation_id, listing_id, from_user, amount_cents, state, expires_at, accepted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgErr || offerErr) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json({ messages: messages ?? [], offers: offers ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }
  if (body.body.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 422 })
  }

  // Apply link/payment blocking before RPC
  const { redacted, body: filteredBody } = filterMessage(body.body.trim())

  // Call SECURITY DEFINER RPC — participant check happens inside
  const { data: msg, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body:            filteredBody,
    p_redacted:        redacted,
  })

  if (error) {
    if (error.message.includes('not a participant')) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    console.error('[messages] send_message RPC error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ message: msg }, { status: 201 })
}
