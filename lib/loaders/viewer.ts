/**
 * Viewer loader — GET /api/me: everything the app chrome needs at boot and after sign-in.
 *
 * The profile row is read with the service client scoped to the caller's own id (the same read
 * the settings shell does; PII columns are service-role only since migration 0044). Counts reuse
 * the exact queries behind GET /api/notifications and GET /api/conversations/unread. Public flags
 * are the subset a client may act on (hide entry points, not authorise anything).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServiceClientRaw } from '@/lib/supabase/service'
import {
  AUTH_BADGE_ENABLED, BOOSTED_POSTS_ENABLED, BUMP_ENABLED, FOLLOWS_ENABLED, NOTIFICATIONS_ENABLED,
  PHONE_VERIFICATION_ENABLED, REVIEWS_ENABLED, SAVED_SEARCH_ALERTS_ENABLED, SHIPPING_LABELS_ENABLED,
  TIER_DASHBOARD_ENABLED, VERIFICATION_ENABLED, RECS_TELEMETRY_ENABLED,
} from '@/lib/flags'
import { normalizeSizes, type UserSizes } from '@/lib/sizes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

/** Flags a client may read. Never used for authorisation — routes re-check server-side. */
export type PublicFlags = {
  verification: boolean
  boosts: boolean
  bump: boolean
  saved_search_alerts: boolean
  notifications: boolean
  auth_badge: boolean
  shipping_labels: boolean
  follows: boolean
  reviews: boolean
  phone_verification: boolean
  tier_dashboard: boolean
  recs_telemetry: boolean
}

export function publicFlags(): PublicFlags {
  return {
    verification: VERIFICATION_ENABLED,
    boosts: BOOSTED_POSTS_ENABLED,
    bump: BUMP_ENABLED,
    saved_search_alerts: SAVED_SEARCH_ALERTS_ENABLED,
    notifications: NOTIFICATIONS_ENABLED,
    auth_badge: AUTH_BADGE_ENABLED,
    shipping_labels: SHIPPING_LABELS_ENABLED,
    follows: FOLLOWS_ENABLED,
    reviews: REVIEWS_ENABLED,
    phone_verification: PHONE_VERIFICATION_ENABLED,
    tier_dashboard: TIER_DASHBOARD_ENABLED,
    recs_telemetry: RECS_TELEMETRY_ENABLED,
  }
}

export type ViewerProfile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  is_moderator: boolean
  id_verification_status: string
  payouts_enabled: boolean
  phone_verified: boolean
  lifetime_sales_count: number
  sizes: UserSizes
  hide_not_my_size: boolean
  created_at: string
  username_changed_at: string | null
  banned: boolean
  banned_reason: string | null
}

export type Me = {
  user: { id: string; email: string | null; email_confirmed: boolean }
  /** null until POST /api/profile (or the web signup) created the row → the app shows onboarding. */
  profile: ViewerProfile | null
  counts: { unread_notifications: number; unread_conversations: number; active_orders: number }
  flags: PublicFlags
}

const ACTIVE_ORDER_STATES = ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed']

export async function loadMe(opts: { supabase: Client; user: User }): Promise<Me> {
  const { supabase, user } = opts
  const svc = createServiceClientRaw()
  const [{ data: profile }, notifCount, unreadRes, { count: activeOrders }] = await Promise.all([
    svc
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, is_moderator, id_verification_status, payouts_enabled, phone_verified_at, lifetime_sales_count, sizes, hide_not_my_size, created_at, username_changed_at, banned, banned_reason')
      .eq('id', user.id)
      .maybeSingle(),
    NOTIFICATIONS_ENABLED
      ? supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      : Promise.resolve({ count: 0 }),
    supabase.rpc('unread_conversation_counts'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .in('state', ACTIVE_ORDER_STATES),
  ])

  let unreadConversations = 0
  if (!unreadRes.error) {
    for (const r of ((unreadRes.data ?? []) as Array<{ conversation_id: string; unread: number }>)) unreadConversations += r.unread
  }

  const p = profile as Record<string, unknown> | null
  return {
    user: { id: user.id, email: user.email ?? null, email_confirmed: !!user.email_confirmed_at },
    profile: p
      ? {
        id: p.id as string,
        username: (p.username as string) ?? '',
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        role: (p.role as string) ?? 'member',
        is_moderator: p.is_moderator === true,
        id_verification_status: (p.id_verification_status as string) ?? 'unverified',
        payouts_enabled: p.payouts_enabled === true,
        phone_verified: Boolean(p.phone_verified_at),
        lifetime_sales_count: (p.lifetime_sales_count as number) ?? 0,
        sizes: normalizeSizes(p.sizes),
        hide_not_my_size: p.hide_not_my_size === true,
        created_at: p.created_at as string,
        username_changed_at: (p.username_changed_at as string | null) ?? null,
        banned: p.banned === true,
        banned_reason: (p.banned_reason as string | null) ?? null,
      }
      : null,
    counts: {
      unread_notifications: (notifCount as { count: number | null }).count ?? 0,
      unread_conversations: unreadConversations,
      active_orders: activeOrders ?? 0,
    },
    flags: publicFlags(),
  }
}
