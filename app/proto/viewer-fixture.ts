/**
 * Fixture identity for the proto tour (`/styleguide/proto/**`).
 *
 * This is DISPLAY DATA, not a session. It grants nothing: every real route still
 * resolves its viewer with getUser() server-side, so /settings, /sell, /saved,
 * /orders and /messages keep redirecting to /enter and every API call still 401s.
 * The proto routes never call those APIs — they render these constants instead.
 */
import type { NotificationItem } from '@/app/components/notifications-popout'

export const PROTO_BASE = '/styleguide/proto'

/**
 * Public-by-nature build flag. When `'1'`, the site header's SELL / SAVED /
 * MESSAGES / account chrome points at this tour (same as localhost development).
 * Display only — real `/saved` `/sell` `/messages` `/settings` still gate.
 * Live `/browse` keeps its own listings; this never injects fixture cards there.
 */
export const PROTO_TOUR = process.env.NEXT_PUBLIC_PROTO_TOUR === '1'

export const PROTO_VIEWER = {
  username: 'archive.tony',
  displayName: 'Tony Field',
}

/** True for any route inside the proto tour. */
export function isProtoPath(pathname: string): boolean {
  return pathname === PROTO_BASE || pathname.startsWith(PROTO_BASE + '/')
}

/**
 * Fixture notifications for the header popout. Every `url` points back inside the
 * tour, and no row is an unread offer — the inline ACCEPT / COUNTER / DECLINE
 * actions hit real offer routes, so the fixtures deliberately never show them.
 */
export const PROTO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'pn1',
    type: 'message',
    title: 'New message',
    body: 'Still available?',
    url: `${PROTO_BASE}/messages/t1`,
    data: { actorName: 'atelier.east', preview: 'Still available?', brand: 'The Row', itemTitle: 'Boxy wool overcoat' },
    read_at: null,
    created_at: '2026-09-14T15:40:00.000Z',
  },
  {
    id: 'pn2',
    type: 'price_drop',
    title: 'Price drop',
    body: 'Saved item dropped',
    url: `${PROTO_BASE}/proto-06`,
    data: { amountCents: 16000, oldAmountCents: 19000, brand: 'Alpha Industries', itemTitle: 'Nylon bomber' },
    read_at: null,
    created_at: '2026-09-14T09:10:00.000Z',
  },
  {
    id: 'pn3',
    type: 'listing_approved',
    title: 'Listing approved',
    body: 'Now live',
    url: `${PROTO_BASE}/sell`,
    data: { brand: 'Lemaire', itemTitle: 'Pleated wool trouser' },
    read_at: '2026-09-13T20:00:00.000Z',
    created_at: '2026-09-13T18:30:00.000Z',
  },
  {
    id: 'pn4',
    type: 'shipped',
    title: 'On the way',
    body: 'Shipped',
    url: `${PROTO_BASE}/settings/orders`,
    data: { brand: 'Maison Margiela', itemTitle: 'Tabi leather ankle boot' },
    read_at: '2026-09-12T11:00:00.000Z',
    created_at: '2026-09-12T08:00:00.000Z',
  },
]

/** MESSAGES badge count for the proto header (matches the fixture inbox). */
export const PROTO_UNREAD_MESSAGES = 1
