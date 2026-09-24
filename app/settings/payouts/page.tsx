/**
 * /settings/payouts — Stripe Connect Express onboarding for sellers, inside the
 * settings shell. `?onboarding=complete|pending` is the return from Stripe (see
 * app/api/stripe/connect/return).
 */
import type { Metadata } from 'next'
import SettingsShell from '../settings-shell'

export const metadata: Metadata = { title: 'Payouts' }

interface PageProps {
  searchParams: Promise<{ onboarding?: string; error?: string }>
}

export default async function PayoutsSettingsPage({ searchParams }: PageProps) {
  const { onboarding, error } = await searchParams
  // `complete` = the return route verified the account with Stripe and payouts are enabled;
  // `pending` = the seller came back but Stripe has not enabled payouts yet (review, or a
  // requirement still due). Both mean onboarding was submitted.
  return <SettingsShell section="payouts" payoutOnboardingDone={onboarding === 'complete' || onboarding === 'pending'} payoutError={error === 'country' ? 'country' : null} />
}
