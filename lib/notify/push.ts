// Web-push adapter — SERVER ONLY. Loads the optional `web-push` package at runtime via
// createRequire so the app type-checks and runs WITHOUT the dependency installed (fail-soft
// no-op). Once `npm i web-push` + VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set, pushes send.
import { createRequire } from 'node:module'

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }

// undefined = not tried yet, null = unavailable/unconfigured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any | null | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWebPush(): any | null {
  if (cached !== undefined) return cached
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:notifications@localhost'
  if (!pub || !priv) { cached = null; return null }
  try {
    const req = createRequire(import.meta.url)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wp: any = req('web-push')
    wp.setVapidDetails(subject, pub, priv)
    cached = wp
  } catch {
    cached = null // package not installed
  }
  return cached
}

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url: string | null },
): Promise<boolean> {
  const wp = getWebPush()
  if (!wp) return false
  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url }),
    )
    return true
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode
    // 404/410 ⇒ the subscription is gone; the next dispatch simply finds fewer rows.
    console.warn('[notify/push] send failed:', code ?? e)
    return false
  }
}
