/**
 * GET /api/conversations/unread — per-conversation unread counts for the caller
 * (header MESSAGES badge + inbox rows). Backed by the unread_conversation_counts()
 * RPC (SECURITY INVOKER → participant RLS). Fail-soft: an RPC error returns zeros
 * so the header never breaks over a badge.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('unread_conversation_counts')
  if (error) {
    console.warn('[conversations/unread] rpc failed (non-blocking):', error.message)
    return NextResponse.json({ total: 0, byConversation: {} })
  }
  const rows = (data ?? []) as Array<{ conversation_id: string; unread: number }>
  const byConversation: Record<string, number> = {}
  let total = 0
  for (const r of rows) {
    byConversation[r.conversation_id] = r.unread
    total += r.unread
  }
  return NextResponse.json({ total, byConversation })
}
