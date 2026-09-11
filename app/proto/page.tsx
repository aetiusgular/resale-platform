import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import ProtoBrowse from './proto-browse'

export const metadata: Metadata = {
  title: 'Prototype browse',
  robots: { index: false, follow: false },
}

export default function ProtoPage() {
  return (
    <AppShell username="">
      <ProtoBrowse hrefBase="/proto" />
    </AppShell>
  )
}
