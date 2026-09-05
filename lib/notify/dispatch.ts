// Notification dispatch — SERVER ONLY. Callers gate on NOTIFICATIONS_ENABLED. Fail-soft
// everywhere: a notification must NEVER block or break the primary action (order, message…).
import type { createServiceClientRaw } from '@/lib/supabase/service'
import type { NotifyEvent, NotifyContext, NotificationPrefs } from './types'
import { channelsFor } from './prefs'
import { renderNotification } from './templates'
import { sendEmail } from './email'
import { sendPush, type PushSubscriptionRow } from './push'
import { sendApns } from './apns'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export async function notify(
  service: ServiceClient,
  recipientId: string,
  event: NotifyEvent,
  ctx: NotifyContext = {},
): Promise<void> {
  try {
    const [{ data: prefsRow }, authRes] = await Promise.all([
      service.from('notification_prefs').select('*').eq('user_id', recipientId).maybeSingle(),
      service.auth.admin.getUserById(recipientId),
    ])
    const channels = channelsFor(event, prefsRow as NotificationPrefs | null)
    const r = renderNotification(event, ctx)

    if (channels.includes('in_app')) {
      await service.from('notifications').insert({
        user_id: recipientId, type: event, title: r.title, body: r.body, url: r.url,
        data: ctx as Record<string, unknown>,
      })
    }
    if (channels.includes('email')) {
      const to = authRes.data?.user?.email
      if (to) await sendEmail({ to, subject: r.email.subject, text: r.email.text, html: r.email.html })
    }
    if (channels.includes('push')) {
      // Two transports, one channel: Web Push subscriptions (browser) and native device tokens.
      const [{ data: subs }, { data: devices }] = await Promise.all([
        service.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', recipientId),
        service.from('push_devices').select('id, platform, token').eq('user_id', recipientId),
      ])
      for (const s of (subs ?? []) as PushSubscriptionRow[]) {
        await sendPush(s, { title: r.title, body: r.body, url: r.url })
      }
      for (const d of (devices ?? []) as Array<{ id: string; platform: string; token: string }>) {
        if (d.platform !== 'ios') continue // FCM branch lands with archive-android
        const res = await sendApns(d.token, {
          title: r.title, body: r.body, url: r.url,
          collapseId: ctx.conversationId ? `conv:${ctx.conversationId}` : undefined,
        })
        // A dead token (410 Unregistered / BadDeviceToken) is removed so it is not retried forever.
        if (res && !res.ok && res.unregistered) {
          await service.from('push_devices').delete().eq('id', d.id)
        } else if (res && !res.ok) {
          console.warn('[notify/apns] send failed:', res.status, res.reason)
        }
      }
    }
  } catch (e) {
    console.warn('[notify] dispatch failed (non-blocking):', e)
  }
}
