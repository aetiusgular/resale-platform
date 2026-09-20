// Preference resolution — PURE. in_app is always on; email/push follow per-category
// opt-out flags (default true). Absent/null prefs row ⇒ all defaults.
import type { NotifyEvent, NotifyCategory, NotifyChannel, NotificationPrefs } from './types'

export const DEFAULT_PREFS: NotificationPrefs = {
  email_offers: true, push_offers: true,
  email_offer_result: true, push_offer_result: true,
  email_messages: true, push_messages: true,
  email_sold: true, push_sold: true,
  email_price_drops: true, push_price_drops: true,
  email_search_alerts: true, push_search_alerts: true,
  email_orders: true, push_orders: true,
  email_alerts: true, push_alerts: true,
}

/** Settings → Notifications rows, in display order (email + push checkbox per row). */
export const PREF_ROWS: ReadonlyArray<{ id: Exclude<NotifyCategory, 'alerts'>; label: string }> = [
  { id: 'offers',        label: 'Offers on my listings' },
  { id: 'offer_result',  label: 'Offer accepted or declined' },
  { id: 'messages',      label: 'New messages' },
  { id: 'sold',          label: 'Item sold' },
  { id: 'price_drops',   label: 'Price drops on saved items' },
  { id: 'search_alerts', label: 'Saved search alerts' },
  { id: 'orders',        label: 'Order & shipping updates' },
]

const CATEGORY_OF: Record<NotifyEvent, NotifyCategory> = {
  offer_received: 'offers',
  offer_accepted: 'offer_result',
  offer_declined: 'offer_result',
  offer_countered: 'offer_result',
  sale: 'sold',
  price_drop: 'price_drops',
  listing_approved: 'alerts',
  shipped: 'orders',
  delivered: 'orders',
  dispute: 'orders',
  message: 'messages',
  tier_expiry: 'orders',
  saved_search: 'search_alerts',
  buyer_reward: 'alerts',
  elite_program: 'alerts',
  admin_elite_lead: 'alerts',
  moderator_granted: 'alerts',
  measurement_request: 'alerts',
  measurements_added: 'alerts',
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
