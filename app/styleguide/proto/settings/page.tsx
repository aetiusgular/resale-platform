import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import ProtoSettings from '../proto-settings'

export const metadata: Metadata = {
  title: 'Prototype settings',
  robots: { index: false, follow: false },
}

export default function ProtoSettingsHubPage() {
  return (
    <AppShell username="">
      <ProtoSettings section="hub" />
    </AppShell>
  )
}
