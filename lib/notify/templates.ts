// Notification rendering — PURE. One place turns an event + context into the in-app row
// (title/body/url) and the email (subject/text/html). No I/O, so it is fully unit-tested.
import type { NotifyEvent, NotifyContext, RenderedNotification } from './types'
import { categoryOf } from './prefs'

const money = (c?: number) => (typeof c === 'number' ? `$${(c / 100).toFixed(2)}` : '')

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function parts(event: NotifyEvent, ctx: NotifyContext): { title: string; body: string; url: string | null } {
  const item = ctx.itemTitle ?? 'your item'
  const who = ctx.actorName ? `@${ctx.actorName}` : 'Someone'
  switch (event) {
    case 'offer_received':
      return { title: 'New offer', body: `${who} offered ${money(ctx.amountCents)} on ${item}.`, url: ctx.conversationId ? `/messages/${ctx.conversationId}` : '/messages' }
    case 'offer_accepted':
      return { title: 'Offer accepted', body: `${who} accepted your ${money(ctx.amountCents)} offer on ${item}. Complete checkout to secure it.`, url: ctx.listingId ? `/checkout/${ctx.listingId}` : '/messages' }
    case 'sale':
      return { title: 'Your item sold', body: `${item} sold for ${money(ctx.amountCents)}. Confirm and ship to get paid.`, url: ctx.orderId ? `/orders/${ctx.orderId}` : '/orders' }
    case 'shipped':
      return { title: 'On the way', body: `${item} has shipped.`, url: ctx.orderId ? `/orders/${ctx.orderId}` : '/orders' }
    case 'delivered':
      return { title: 'Delivered', body: `${item} was delivered — the payout is on the way.`, url: ctx.orderId ? `/orders/${ctx.orderId}` : '/orders' }
    case 'dispute':
      return { title: 'Order disputed', body: `A dispute was opened on ${item}. We will review it shortly.`, url: ctx.orderId ? `/orders/${ctx.orderId}` : '/orders' }
    case 'message':
      return { title: ctx.actorName ? `New message from ${who}` : 'New message', body: ctx.preview ? ctx.preview.slice(0, 140) : 'You have a new message.', url: ctx.conversationId ? `/messages/${ctx.conversationId}` : '/messages' }
    case 'saved_search':
      return { title: 'New match for your saved search', body: `${item} just listed${ctx.amountCents ? ` for ${money(ctx.amountCents)}` : ''}.`, url: ctx.listingId ? `/listings/${ctx.listingId}` : '/browse' }
    case 'tier_expiry': {
      const isSeller = ctx.tierSide !== 'buyer'
      const feeLabel = isSeller ? 'seller fee' : 'buyer fee'
      const noun = isSeller ? 'sales' : 'purchases'
      const from = typeof ctx.fromBps === 'number' ? (ctx.fromBps / 100).toFixed(1) : ''
      const to = typeof ctx.toBps === 'number' ? (ctx.toBps / 100).toFixed(1) : ''
      const move = from && to ? ` from ${from}% to ${to}%` : ''
      return { title: 'Your fee rate may rise soon', body: `Some of your ${noun} are about to roll out of your 12-month window. Without new ${noun}, your ${feeLabel} could move${move}.`, url: '/settings?section=power' }
    }
  }
}

export function renderNotification(event: NotifyEvent, ctx: NotifyContext): RenderedNotification {
  const { title, body, url } = parts(event, ctx)
  const base = ctx.appUrl?.replace(/\/$/, '') ?? ''
  const absUrl = url ? `${base}${url}` : base || '#'
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:480px">` +
    `<h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(title)}</h2>` +
    `<p style="font-size:14px;line-height:1.5;color:#333;margin:0 0 16px">${escapeHtml(body)}</p>` +
    `<a href="${absUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:2px;font-size:14px">View</a>` +
    `</div>`
  return { category: categoryOf(event), title, body, url, email: { subject: title, text: `${body}\n\n${absUrl}`, html } }
}
