'use client'

/**
 * Web-push on this device (G2). `usePushStatus()` registers /sw.js, requests
 * permission, subscribes via the PushManager with the public VAPID key and stores
 * the subscription; it powers both the notifications popout prompt and the
 * Settings → Notifications pane. Capability detection + state updates all happen
 * in async callbacks (never synchronously in the effect body). Reports
 * 'unconfigured' when NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing and 'unsupported'
 * when the browser can't do push.
 */
import { useEffect, useState } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export type PushStatus = 'unknown' | 'unsupported' | 'unconfigured' | 'subscribed' | 'unsubscribed' | 'denied' | 'working'

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function usePushStatus() {
  const [status, setStatus] = useState<PushStatus>('unknown')

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

  return { status, subscribe, unsubscribe }
}

export function pushStatusLine(status: PushStatus): string {
  switch (status) {
    case 'unknown': return 'CHECKING…'
    case 'unconfigured': return 'PUSH ISN’T CONFIGURED YET'
    case 'unsupported': return 'NOT SUPPORTED IN THIS BROWSER'
    case 'denied': return 'BLOCKED — ALLOW NOTIFICATIONS IN YOUR BROWSER SETTINGS'
    case 'subscribed': return 'PUSH ENABLED — THIS BROWSER'
    case 'unsubscribed': return 'PUSH IS OFF IN THIS BROWSER'
    case 'working': return '…'
  }
}

/** Settings → Notifications: push banner / status line. */
export default function PushSubscribe() {
  const { status, subscribe, unsubscribe } = usePushStatus()

  if (status === 'unsubscribed') {
    return (
      <div className="push-banner">
        <span>Push is off in this browser.</span>
        <button type="button" className="link-underline link-underline--ink" onClick={subscribe}>ENABLE PUSH →</button>
      </div>
    )
  }
  if (status === 'subscribed') {
    return (
      <div className="push-banner">
        <span>Push is on in this browser.</span>
        <button type="button" className="link-underline" onClick={unsubscribe}>DISABLE</button>
      </div>
    )
  }
  return <div className="push-note">{pushStatusLine(status)}</div>
}
