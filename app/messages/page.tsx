/**
 * /messages — conversation inbox (design 1A).
 * Desktop: two-pane — sidebar list + "select a conversation" empty pane.
 * Mobile: full-width list; a thread opens as its own route.
 * If ?listing=<id> is present, auto-creates or finds the conversation and redirects.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import AppShell from '@/app/components/app-shell'
import InboxList from './inbox-list'
import { loadInbox } from './inbox'
import { ChatIcon } from '@/app/components/icons'

export const metadata: Metadata = { title: 'Messages' }

interface PageProps {
  searchParams: Promise<{ listing?: string }>
}

export default async function MessagesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const [{ data: profileRow }, searchParamsResolved] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    searchParams,
  ])
  const username: string = (profileRow?.username as string) ?? ''

  const { listing: listingId } = searchParamsResolved

  // Auto-create conversation if ?listing= present
  if (listingId) {
    const service = createServiceClientRaw()
    const { data: listingRow } = await service
      .from('listings')
      .select('id, seller_id, status')
      .eq('id', listingId)
      .single()

    if (listingRow && listingRow.seller_id !== user.id &&
        listingRow.status !== 'sold' && listingRow.status !== 'removed') {
      const { data: existing } = await service
        .from('conversations')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .eq('seller_id', listingRow.seller_id)
        .maybeSingle()

      if (existing) {
        redirect(`/messages/${existing.id}`)
      } else {
        const { data: created } = await service
          .from('conversations')
          .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listingRow.seller_id })
          .select('id')
          .single()
        if (created) redirect(`/messages/${created.id}`)
      }
    }
    // Fall through to inbox if listing not found / user is seller
  }

  const rows = await loadInbox(supabase, user.id)

  return (
    <AppShell username={username} footer={false}>
      <div className="msgs">
        <InboxList rows={rows} />
        <div className="thread">
          <div className="empty" style={{ margin: 'auto', color: 'var(--faint)' }}>
            <ChatIcon />
            <div className="empty__title" style={{ paddingTop: 12 }}>Select a conversation</div>
            <div className="empty__sub">OFFERS, QUESTIONS AND ORDER CHAT LIVE HERE</div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
