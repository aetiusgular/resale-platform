/**
 * /settings/payouts — Stripe Connect Express onboarding for sellers, inside the
 * settings shell. `?onboarding=complete` is the return from Stripe.
 */
import type { Metadata } from 'next'
import SettingsShell from '../settings-shell'

export const metadata: Metadata = { title: 'Payouts' }

interface PageProps {
  searchParams: Promise<{ onboarding?: string }>
}

export default async function PayoutsSettingsPage({ searchParams }: PageProps) {
  const { onboarding } = await searchParams
  return <SettingsShell section="payouts" payoutOnboardingDone={onboarding === 'complete'} />
}
