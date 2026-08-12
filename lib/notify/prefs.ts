// Preference resolution — PURE. in_app is always on; email/push follow per-category
// opt-out flags (default true). Absent/null prefs row ⇒ all defaults.
import type { NotifyEvent, NotifyCategory, NotifyChannel, NotificationPrefs } from './types'

export const DEFAULT_PREFS: NotificationPrefs = {
  email_offers: true, push_offers: true,
  email_orders: true, push_orders: true,
  email_messages: true, push_messages: true,
  email_alerts: true, push_alerts: true,
}

const CATEGORY_OF: Record<NotifyEvent, NotifyCategory> = {
  offer_received: 'offers',
  offer_accepted: 'offers',
  sale: 'orders',
  shipped: 'orders',
  delivered: 'orders',
  dispute: 'orders',
  message: 'messages',
  tier_expiry: 'orders',
  saved_search: 'alerts',
  buyer_reward: 'alerts',
  elite_program: 'alerts',
  admin_elite_lead: 'alerts',
}

export function categoryOf(event: NotifyEvent): NotifyCategory {
  return CATEGORY_OF[event]
}

export function channelsFor(
  event: NotifyEvent,
  prefs: Partial<NotificationPrefs> | null,
): NotifyChannel[] {
  const p = { ...DEFAULT_PREFS, ...(prefs ?? {}) }
  const cat = CATEGORY_OF[event]
  const channels: NotifyChannel[] = ['in_app']
  if (p[`email_${cat}` as keyof NotificationPrefs]) channels.push('email')
  if (p[`push_${cat}` as keyof NotificationPrefs]) channels.push('push')
  return channels
}
