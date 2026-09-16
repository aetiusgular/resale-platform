import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/app/components/app-shell'
import type { SettingsSection } from '@/app/settings/settings-sections'
import ProtoSettings from '../../proto-settings'

/** Sections the tour can show. `review` needs an order to review, so it is left out. */
const SECTIONS: SettingsSection[] = ['profile', 'orders', 'address', 'sizes', 'notifications', 'payouts', 'phone', 'tiers']

interface PageProps {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params
  return { title: `Prototype settings — ${section}`, robots: { index: false, follow: false } }
}

export default async function ProtoSettingsSectionPage({ params }: PageProps) {
  const { section } = await params
  if (!SECTIONS.includes(section as SettingsSection)) notFound()
  return (
    <AppShell username="">
      <ProtoSettings section={section as SettingsSection} />
    </AppShell>
  )
}
