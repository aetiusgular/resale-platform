import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import ProtoBrowse from '@/app/proto/proto-browse'

export const metadata: Metadata = {
  title: 'Prototype browse',
  robots: { index: false, follow: false },
}

/** Public twin of `/proto` — `/styleguide` is already guest-allowlisted in middleware. */
export default function StyleguideProtoPage() {
  return (
    <AppShell username="">
      <ProtoBrowse hrefBase="/styleguide/proto" />
    </AppShell>
  )
}
