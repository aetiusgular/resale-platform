/**
 * /messages/[id] — conversation thread (design 1A).
 * Desktop: sidebar inbox + thread. Mobile: the thread fills the screen with a
 * back control to the inbox (.msgs--thread). Opening the thread moves the
 * caller's read cursor (mark_conversation_read) before the inbox rows load so
 * the badges reflect it in the same render.
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ThreadClient from './thread-client'
import AppShell from '@/app/components/app-shell'
import InboxList from '../inbox-list'
import { loadInbox } from '@/lib/loaders/inbox'
import { loadThread } from '@/lib/loaders/thread'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ counter?: string }>
}

export default async function ThreadPage({ params, searchParams }: PageProps) {
  const [{ id: conversationId }, { counter: counterOfferId }] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  // Read cursor first so the inbox rows + header badge see this thread as read.
  // (RPC is participant-checked; a non-participant gets nothing and 404s below.)
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })

  // ONE data assembly shared with GET /api/conversations/[id] (native clients).
  const [t, rows] = await Promise.all([
    loadThread({ supabase, user, conversationId }),
    loadInbox(supabase, user.id),
  ])
  if (!t) notFound()

  const { conversation: conv, listing, messages, offers, order, is_buyer: isBuyer } = t
  const currentUsername = t.viewer.username
  const meta = t.other.meta

  return (
    <AppShell username={currentUsername} displayName={t.viewer.display_name ?? undefined} footer={false}>
      <div className="msgs msgs--thread">
        <InboxList rows={rows} activeId={conversationId} />
        <ThreadClient
          conversationId={conversationId}
          currentUserId={user.id}
          initialMessages={messages}
          initialOffers={offers}
          conversation={conv}
          listing={listing}
          order={order}
          isBuyer={isBuyer}
          counterOfferId={counterOfferId ?? null}
          other={{
            username: t.other.username,
            verified: t.other.verified,
            meta,
          }}
        />
      </div>
    </AppShell>
  )
}
