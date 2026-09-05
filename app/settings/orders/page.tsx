/**
 * /settings/orders — orders inside the settings shell (reference: ORDERS section).
 * `?role=buying|selling` is kept for old /orders links.
 */
import type { Metadata } from 'next'
import SettingsShell from '../settings-shell'

export const metadata: Metadata = { title: 'Orders' }

export default async function SettingsOrdersPage() {
  return <SettingsShell section="orders" />
}
