import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SettingsShell, { resolveSection } from '../settings-shell'

const TITLES: Record<string, string> = {
  address: 'Shipping address', sizes: 'My sizes', notifications: 'Notifications', phone: 'Phone', tiers: 'Fees & tiers',
}
// orders / review / payouts have their own route files (they take search params).

interface PageProps {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params
  return { title: TITLES[section] ?? 'Settings' }
}

/** /settings/<address|sizes|notifications|phone|tiers> */
export default async function SettingsSectionPage({ params }: PageProps) {
  const { section } = await params
  if (!(section in TITLES)) notFound()
  return <SettingsShell section={resolveSection(section)} />
}
