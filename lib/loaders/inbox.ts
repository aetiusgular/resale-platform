import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCents } from '@/lib/fees'

/**
 * Inbox rows for the messages sidebar (shared by /messages, /messages/[id] and
 * GET /api/conversations for the native apps).
 * One conversations query + one latest-message sweep (≤ 50 conversations) + the
 * caller's unread counts (unread_conversation_counts RPC → conv__badge, "n UNREAD").
 */
export type InboxRow = {
  id: string
  handle: string
  role: 'BUYING' | 'SELLING'
  brand: string
  title: string
  price: string
  status: string
  image: string | null
  preview: string
  previewMine: boolean
  unread: number
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadInbox(supabase: SupabaseClient<any>, userId: string): Promise<InboxRow[]> {
  const [{ data: conversations }, { data: unreadRows }] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, listing_id, buyer_id, seller_id, updated_at,
        listings:listing_id (title, brand, price_cents, images, status),
        buyer:buyer_id (username),
        seller:seller_id (username)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase.rpc('unread_conversation_counts'),
  ])

  const rows = (conversations ?? []) as unknown as Array<{
    id: string; listing_id: string; buyer_id: string; seller_id: string; updated_at: string
    listings: { title: string; brand: string; price_cents: number; images: string[]; status: string } | null
    buyer: { username: string } | null
    seller: { username: string } | null
  }>
  const unreadBy = new Map<string, number>()
  for (const r of ((unreadRows ?? []) as Array<{ conversation_id: string; unread: number }>)) unreadBy.set(r.conversation_id, r.unread)

  const latest = new Map<string, { body: string; sender_id: string; created_at: string }>()
  if (rows.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, body, sender_id, created_at')
      .in('conversation_id', rows.map((r) => r.id))
      .order('created_at', { ascending: false })
      .limit(300)
    for (const m of msgs ?? []) {
      if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, { body: m.body, sender_id: m.sender_id, created_at: m.created_at })
    }
  }

  return rows.map((c) => {
    const isBuyer = c.buyer_id === userId
    const other = isBuyer ? c.seller : c.buyer
    const last = latest.get(c.id)
    return {
      id: c.id,
      handle: other?.username ?? '—',
      role: isBuyer ? 'BUYING' : 'SELLING',
      brand: c.listings?.brand ?? '—',
      title: c.listings?.title ?? '—',
      price: c.listings ? formatCents(c.listings.price_cents) : '',
      status: c.listings?.status ?? 'active',
      image: c.listings?.images?.[0] ?? null,
      preview: last?.body ?? 'No messages yet — say hello.',
      previewMine: last ? last.sender_id === userId : false,
      unread: unreadBy.get(c.id) ?? 0,
      updated_at: last?.created_at ?? c.updated_at,
    }
  })
}
