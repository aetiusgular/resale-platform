/**
 * /checkout/success
 * Landing page after payment_intent.succeeded.
 * Polls for the order to be created (webhook may take a few seconds).
 */
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pi = searchParams.get('pi')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!pi || orderId) return
    if (attempts > 10) return // Give up after ~10s

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orders/by-intent?pi=${encodeURIComponent(pi)}`)
        if (res.ok) {
          const { orderId: id } = await res.json()
          if (id) {
            setOrderId(id)
            router.replace(`/orders/${id}`)
            return
          }
        }
      } catch { /* retry */ }
      setAttempts(a => a + 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [pi, orderId, attempts, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--color-ink)', marginBottom: 12 }}>
          PAYMENT CONFIRMED
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginBottom: 24 }}>
          {attempts <= 10
            ? 'Setting up your order…'
            : 'Your order is being processed. Check your orders page in a moment.'}
        </div>
        {attempts > 10 && (
          <Link href="/orders" style={{ font: '500 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'underline' }}>
            View my orders
          </Link>
        )}
      </div>
    </div>
  )
}
