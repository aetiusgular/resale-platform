'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckoutSuccessContent() {
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
    <main className="page-main page-main--narrow">
      <div className="page-head page-head--ruled">
        <h1 className="page-title">Payment confirmed.</h1>
        <span className="page-note">HELD IN ESCROW</span>
      </div>
      <p className="body-copy" style={{ paddingTop: 18 }}>
        {attempts <= 10
          ? 'Setting up your order — this takes a moment.'
          : 'Your order is being processed. Check your orders page in a moment.'}
      </p>
      <div className="mt-24">
        <div className="kv"><span className="kv__k">01</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>THE SELLER CONFIRMS AND SHIPS ON A PREPAID LABEL</span></div>
        <div className="kv"><span className="kv__k">02</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>YOU CONFIRM DELIVERY — OR OPEN A DISPUTE WITHIN 72H</span></div>
        <div className="kv"><span className="kv__k">03</span><span className="kv__v kv__v--dim" style={{ textAlign: 'left', flex: 1 }}>FUNDS RELEASE TO THE SELLER</span></div>
      </div>
      <div className="save-row save-row--left">
        {orderId ? (
          <Link href={`/orders/${orderId}`} className="btn-primary btn-primary--inline">VIEW ORDER →</Link>
        ) : attempts > 10 ? (
          <Link href="/settings/orders" className="btn-primary btn-primary--inline">VIEW MY ORDERS →</Link>
        ) : (
          <span className="mono-note">SETTING UP YOUR ORDER…</span>
        )}
      </div>
    </main>
  )
}
