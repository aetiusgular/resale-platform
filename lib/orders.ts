/**
 * Order state machine constants and helpers.
 * The canonical transition logic lives in the DB (transition_order RPC).
 * This file holds TypeScript-layer constants and utilities.
 */

export type OrderState =
  | 'paid_held'
  | 'seller_confirmed'
  | 'shipped'
  | 'delivered'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'cancelled'

export type EventSource = 'webhook' | 'admin' | 'cron' | 'user'

/** Auto-release window: 3 days after delivered_at (must match pg_cron function). */
export const AUTO_RELEASE_DAYS = 3

/** Dispute window: buyer must open within 72h of delivered_at. */
export const DISPUTE_WINDOW_HOURS = 72

/** Checkout session lock window: listing held for 30 minutes while payment processes. */
export const CHECKOUT_LOCK_MINUTES = 30

/** Legal state transitions (mirrors transition_order() PL/pgSQL logic). */
export const LEGAL_TRANSITIONS: Record<OrderState, OrderState[]> = {
  paid_held:        ['seller_confirmed', 'cancelled'],
  seller_confirmed: ['shipped', 'cancelled'],
  shipped:          ['delivered'],
  delivered:        ['released', 'disputed'],
  disputed:         ['released', 'refunded'],
  released:         [],
  refunded:         [],
  cancelled:        [],
}

/** Returns true if the transition from→to is legal. */
export function isLegalTransition(from: OrderState, to: OrderState): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to)
}

/** Human-readable label for each state (for order timeline UI). */
export const STATE_LABELS: Record<OrderState, string> = {
  paid_held:        'PAID & HELD',
  seller_confirmed: 'SELLER CONFIRMED',
  shipped:          'SHIPPED',
  delivered:        'DELIVERED',
  released:         'FUNDS RELEASED',
  disputed:         'DISPUTED',
  refunded:         'REFUNDED',
  cancelled:        'CANCELLED',
}

/**
 * Returns the auto-release timestamp given a delivered_at date.
 * Used to render the countdown on order status pages.
 */
export function autoReleaseAt(deliveredAt: Date): Date {
  const d = new Date(deliveredAt)
  d.setDate(d.getDate() + AUTO_RELEASE_DAYS)
  return d
}

/**
 * Returns the dispute deadline given a delivered_at date.
 */
export function disputeDeadlineAt(deliveredAt: Date): Date {
  const d = new Date(deliveredAt)
  d.setHours(d.getHours() + DISPUTE_WINDOW_HOURS)
  return d
}

/**
 * Returns true if the dispute window is still open.
 * Server must re-validate this — not just trust client assertions.
 */
export function isDisputeWindowOpen(deliveredAt: Date): boolean {
  return new Date() < disputeDeadlineAt(deliveredAt)
}
