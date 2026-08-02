// Notification dispatch — SERVER ONLY. Callers gate on NOTIFICATIONS_ENABLED. Fail-soft
// everywhere: a notification must NEVER block or break the primary action (order, message…).
import type { createServiceClientRaw } from '@/lib/supabase/service'
import type { NotifyEvent, NotifyContext, NotificationPrefs } from './types'
import { channelsFor } from './prefs'
import { renderNotification } from './templates'
import { sendEmail } from './email'
import { sendPush, type PushSubscriptionRow } from './push'

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
      const { data: subs } = await service
        .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', recipientId)
      for (const s of (subs ?? []) as PushSubscriptionRow[]) {
        await sendPush(s, { title: r.title, body: r.body, url: r.url })
      }
    }
  } catch (e) {
    console.warn('[notify] dispatch failed (non-blocking):', e)
  }
}
