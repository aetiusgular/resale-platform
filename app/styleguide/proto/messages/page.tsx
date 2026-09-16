import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import ProtoMessages from '@/app/proto/proto-messages'

export const metadata: Metadata = {
  title: 'Prototype messages',
  robots: { index: false, follow: false },
}

export default function StyleguideProtoMessagesPage() {
  return (
    <AppShell username="" footer={false}>
      <ProtoMessages hrefBase="/styleguide/proto" />
    </AppShell>
  )
}
