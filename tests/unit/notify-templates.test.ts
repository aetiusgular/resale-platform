import { describe, it, expect } from 'vitest'
import { renderNotification } from '../../lib/notify/templates'

describe('renderNotification', () => {
  it('offer_received: title, actor + amount + item in body, deep link', () => {
    const r = renderNotification('offer_received', { actorName: 'buyer1', itemTitle: 'Raf coat', amountCents: 12000, conversationId: 'c1' })
    expect(r.title).toBe('New offer')
    expect(r.body).toContain('@buyer1')
    expect(r.body).toContain('$120.00')
    expect(r.body).toContain('Raf coat')
    expect(r.url).toBe('/messages/c1')
    expect(r.category).toBe('offers')
  })

  it('sale: links to the order, shows the amount, lands in the ITEM SOLD bucket', () => {
    const r = renderNotification('sale', { itemTitle: 'Tee', amountCents: 4500, orderId: 'o9' })
    expect(r.title).toBe('Your item sold')
    expect(r.body).toContain('$45.00')
    expect(r.url).toBe('/orders/o9')
    // Settings → Notifications row "Item sold" (design 2E) — its own bucket, not orders.
    expect(r.category).toBe('sold')
  })

  it('message: title names the sender and body is the truncated preview', () => {
    const long = 'x'.repeat(200)
    const r = renderNotification('message', { actorName: 'seller2', preview: long, conversationId: 'c7' })
    expect(r.title).toBe('New message from @seller2')
    expect(r.body.length).toBe(140)
    expect(r.url).toBe('/messages/c7')
  })

  it('email html escapes user content and uses the absolute appUrl base', () => {
    const r = renderNotification('offer_received', { actorName: '<script>', itemTitle: 'A & B', amountCents: 100, conversationId: 'c1', appUrl: 'https://app.example.com/' })
    expect(r.email.html).toContain('&lt;script&gt;')
    expect(r.email.html).not.toContain('<script>')
    expect(r.email.html).toContain('A &amp; B')
    expect(r.email.html).toContain('https://app.example.com/messages/c1')
    expect(r.email.text).toContain('https://app.example.com/messages/c1')
  })

  it('falls back to generic copy when context is sparse', () => {
    const r = renderNotification('message', {})
    expect(r.body).toBe('You have a new message.')
    expect(r.url).toBe('/messages')
  })

  it('tier_expiry: names the side, shows the rate move, links to the tier pane', () => {
    const r = renderNotification('tier_expiry', { tierSide: 'seller', fromBps: 300, toBps: 350 })
    expect(r.title).toBe('Your fee rate may rise soon')
    expect(r.body).toContain('seller fee')
    expect(r.body).toContain('from 3.0% to 3.5%')
    expect(r.url).toBe('/settings?section=power')
    expect(r.category).toBe('orders')
  })

  it('tier_expiry (buyer): uses buyer wording', () => {
    const r = renderNotification('tier_expiry', { tierSide: 'buyer', fromBps: 400, toBps: 500 })
    expect(r.body).toContain('buyer fee')
    expect(r.body).toContain('purchases')
  })

  it('saved_search: names the item + price, links to the listing, SAVED SEARCH ALERTS bucket', () => {
    const r = renderNotification('saved_search', { itemTitle: 'Raf bomber', amountCents: 40000, listingId: 'l1' })
    expect(r.title).toBe('New match for your saved search')
    expect(r.body).toContain('Raf bomber')
    expect(r.body).toContain('$400.00')
    expect(r.url).toBe('/listings/l1')
    // Settings → Notifications row "Saved search alerts" (design 2E).
    expect(r.category).toBe('search_alerts')
  })

  it('offer_countered / offer_declined / price_drop / listing_approved: reference copy + deep links', () => {
    const c = renderNotification('offer_countered', { actorName: 'archivebin', itemTitle: 'Wool coat', amountCents: 52000, conversationId: 'c2' })
    expect(c.title).toBe('Counter received — $520.00')
    expect(c.url).toBe('/messages/c2')
    expect(c.category).toBe('offer_result')
    const d = renderNotification('offer_declined', { actorName: 'x', itemTitle: 'Tee', amountCents: 1000, conversationId: 'c3' })
    expect(d.category).toBe('offer_result')
    const p = renderNotification('price_drop', { itemTitle: 'Painter jean', amountCents: 19000, oldAmountCents: 24000, listingId: 'l2' })
    expect(p.title).toBe('Saved item now $190.00')
    expect(p.body).toContain('was $240.00')
    expect(p.url).toBe('/listings/l2')
    expect(p.category).toBe('price_drops')
    const a = renderNotification('listing_approved', { itemTitle: 'Wool blazer', listingId: 'l3' })
    expect(a.title).toBe('Listing approved — now live')
    expect(a.url).toBe('/listings/l3')
    expect(a.category).toBe('alerts')
  })
})
