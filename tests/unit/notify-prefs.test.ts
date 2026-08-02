import { describe, it, expect } from 'vitest'
import { channelsFor, categoryOf, DEFAULT_PREFS } from '../../lib/notify/prefs'

describe('categoryOf', () => {
  it('maps each event to its category', () => {
    expect(categoryOf('offer_received')).toBe('offers')
    expect(categoryOf('offer_accepted')).toBe('offers')
    expect(categoryOf('sale')).toBe('orders')
    expect(categoryOf('shipped')).toBe('orders')
    expect(categoryOf('delivered')).toBe('orders')
    expect(categoryOf('dispute')).toBe('orders')
    expect(categoryOf('message')).toBe('messages')
  })
})

describe('channelsFor', () => {
  it('null prefs ⇒ all defaults (in_app + email + push)', () => {
    expect(channelsFor('sale', null).sort()).toEqual(['email', 'in_app', 'push'])
  })

  it('in_app is always present even with everything opted out', () => {
    const allOff = {
      email_offers: false, push_offers: false,
      email_orders: false, push_orders: false,
      email_messages: false, push_messages: false,
    }
    expect(channelsFor('message', allOff)).toEqual(['in_app'])
    expect(channelsFor('sale', allOff)).toEqual(['in_app'])
  })

  it('per-category opt-out only affects that category', () => {
    const noOrderEmail = { ...DEFAULT_PREFS, email_orders: false }
    expect(channelsFor('sale', noOrderEmail).sort()).toEqual(['in_app', 'push'])   // orders email off
    expect(channelsFor('offer_received', noOrderEmail).sort()).toEqual(['email', 'in_app', 'push']) // offers unaffected
  })

  it('push opt-out drops push for that category', () => {
    const noMsgPush = { ...DEFAULT_PREFS, push_messages: false }
    expect(channelsFor('message', noMsgPush).sort()).toEqual(['email', 'in_app'])
  })
})
