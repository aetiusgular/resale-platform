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

  it('sale: links to the order and shows the amount', () => {
    const r = renderNotification('sale', { itemTitle: 'Tee', amountCents: 4500, orderId: 'o9' })
    expect(r.title).toBe('Your item sold')
    expect(r.body).toContain('$45.00')
    expect(r.url).toBe('/orders/o9')
    expect(r.category).toBe('orders')
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
})
