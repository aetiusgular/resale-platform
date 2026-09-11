import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/app/components/app-shell'
import ProtoMessages from '@/app/proto/proto-messages'
import { getProtoThread } from '@/app/proto/messages-fixtures'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const thread = getProtoThread(id)
  if (!thread) return { title: 'Conversation not found', robots: { index: false, follow: false } }
  return { title: `@${thread.handle}`, robots: { index: false, follow: false } }
}

export default async function StyleguideProtoThreadPage({ params }: PageProps) {
  const { id } = await params
  if (!getProtoThread(id)) notFound()
  return (
    <AppShell username="" footer={false}>
      <ProtoMessages hrefBase="/styleguide/proto" threadId={id} />
    </AppShell>
  )
}
