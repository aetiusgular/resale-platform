import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import ProtoMessages from '../proto-messages'

export const metadata: Metadata = {
  title: 'Prototype messages',
  robots: { index: false, follow: false },
}

export default function ProtoMessagesPage() {
  return (
    <AppShell username="" footer={false}>
      <ProtoMessages hrefBase="/proto" />
    </AppShell>
  )
}
