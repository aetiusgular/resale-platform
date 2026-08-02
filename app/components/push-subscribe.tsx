'use client'

/**
 * "Enable push on this device" control for the notifications settings pane (G2).
 * Registers /sw.js, requests permission, subscribes via the PushManager with the public
 * VAPID key, and stores the subscription. Capability detection + state updates all happen
 * in async callbacks (never synchronously in the effect body), so no set-state-in-effect.
 * Renders an inert hint when push isn't configured (no NEXT_PUBLIC_VAPID_PUBLIC_KEY) or
 * unsupported by the browser.
 */
import { useEffect, useState } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

type Status = 'unknown' | 'unsupported' | 'unconfigured' | 'subscribed' | 'unsubscribed' | 'denied' | 'working'

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushSubscribe() {
  const [status, setStatus] = useState<Status>('unknown')

  useEffect(() => {
    let cancelled = false
    // Deferred to a microtask so the setState calls are never synchronous in the effect body.
    Promise.resolve().then(async () => {
      if (!VAPID_PUBLIC) { if (!cancelled) setStatus('unconfigured'); return }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setStatus('unsupported'); return
      }
      if (Notification.permission === 'denied') { if (!cancelled) setStatus('denied'); return }
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = reg ? await reg.pushManager.getSubscription() : null
        if (!cancelled) setStatus(sub ? 'subscribed' : 'unsubscribed')
      } catch {
        if (!cancelled) setStatus('unsubscribed')
      }
    })
    return () => { cancelled = true }
  }, [])

  const subscribe = async () => {
    if (!VAPID_PUBLIC) return
    setStatus('working')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus('denied'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
      })
      const j = sub.toJSON()
      await fetch('/api/notifications/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
      })
      setStatus('subscribed')
    } catch {
      setStatus('unsubscribed')
    }
  }

  const unsubscribe = async () => {
    setStatus('working')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('unsubscribed')
    } catch {
      setStatus('subscribed')
    }
  }

  const hint = (text: string) => (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-soft)' }}>{text}</span>
  )

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span style={{ font: '600 13px var(--font-ui)', color: 'var(--color-ink)' }}>Push on this device</span>
      {status === 'unknown' && hint('Checking…')}
      {status === 'unconfigured' && hint('Push isn’t configured yet.')}
      {status === 'unsupported' && hint('Not supported in this browser.')}
      {status === 'denied' && hint('Blocked — allow notifications in your browser settings.')}
      {status === 'unsubscribed' && (
        <button onClick={subscribe} style={{ height: 36, padding: '0 20px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: '1px solid var(--color-ink)', borderRadius: 2, font: '500 13px var(--font-ui)', cursor: 'pointer' }}>Enable push</button>
      )}
      {status === 'subscribed' && (
        <>
          {hint('Enabled')}
          <button onClick={unsubscribe} style={{ height: 36, padding: '0 16px', background: 'var(--color-bg)', color: 'var(--color-ink-soft)', border: '1px solid var(--color-line)', borderRadius: 2, font: '500 13px var(--font-ui)', cursor: 'pointer' }}>Disable</button>
        </>
      )}
      {status === 'working' && hint('…')}
    </div>
  )
}
