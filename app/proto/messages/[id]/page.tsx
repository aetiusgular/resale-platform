import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/app/components/app-shell'
import ProtoMessages from '../../proto-messages'
import { getProtoThread } from '../../messages-fixtures'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const thread = getProtoThread(id)
  if (!thread) return { title: 'Conversation not found', robots: { index: false, follow: false } }
  return { title: `@${thread.handle}`, robots: { index: false, follow: false } }
}

export default async function ProtoThreadPage({ params }: PageProps) {
  const { id } = await params
  if (!getProtoThread(id)) notFound()
  return (
    <AppShell username="" footer={false}>
      <ProtoMessages hrefBase="/proto" threadId={id} />
    </AppShell>
  )
}
