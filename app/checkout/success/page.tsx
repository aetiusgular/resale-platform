/**
 * /checkout/success
 * Landing page after payment_intent.succeeded.
 * Polls for the order to be created (webhook may take a few seconds).
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import { getViewerUsername } from '@/app/components/viewer'
import CheckoutSuccessContent from './checkout-success-content'

export const metadata: Metadata = { title: 'Payment confirmed' }

export default async function CheckoutSuccessPage() {
  const username = await getViewerUsername()
  return (
    <AppShell username={username}>
      <Suspense fallback={<main className="page-main page-main--narrow"><div className="mono-note">SETTING UP YOUR ORDER…</div></main>}>
        <CheckoutSuccessContent />
      </Suspense>
    </AppShell>
  )
}
