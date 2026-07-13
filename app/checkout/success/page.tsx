/**
 * /checkout/success
 * Landing page after payment_intent.succeeded.
 * Polls for the order to be created (webhook may take a few seconds).
 */
import { Suspense } from 'react'
import CheckoutSuccessContent from './checkout-success-content'

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-ink-soft)' }}>
          Setting up your order…
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}
