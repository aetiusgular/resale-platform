import type { Metadata } from 'next'
import SettingsShell, { resolveSection } from './settings-shell'

export const metadata: Metadata = { title: 'Settings' }

interface PageProps {
  searchParams: Promise<{ section?: string }>
}

/** /settings — hub. `?section=` is kept for old links (my-sizes, addresses, payments, power…). */
export default async function SettingsPage({ searchParams }: PageProps) {
  const { section } = await searchParams
  return <SettingsShell section={resolveSection(section)} />
}
