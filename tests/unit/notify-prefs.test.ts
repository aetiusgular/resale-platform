import { describe, it, expect } from 'vitest'
import { channelsFor, categoryOf, DEFAULT_PREFS } from '../../lib/notify/prefs'

describe('categoryOf', () => {
  // Settings → Notifications has one row per bucket (ARCHIVE design review):
  // offers · offer result · messages · sold · price drops · search alerts · orders.
  it('maps each event to its category', () => {
    expect(categoryOf('offer_received')).toBe('offers')
    expect(categoryOf('offer_accepted')).toBe('offer_result')
    expect(categoryOf('offer_declined')).toBe('offer_result')
    expect(categoryOf('offer_countered')).toBe('offer_result')
    expect(categoryOf('sale')).toBe('sold')
    expect(categoryOf('price_drop')).toBe('price_drops')
    expect(categoryOf('saved_search')).toBe('search_alerts')
    expect(categoryOf('shipped')).toBe('orders')
    expect(categoryOf('delivered')).toBe('orders')
    expect(categoryOf('dispute')).toBe('orders')
    expect(categoryOf('message')).toBe('messages')
    expect(categoryOf('listing_approved')).toBe('alerts')
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
      email_sold: false, push_sold: false,
    }
    expect(channelsFor('message', allOff)).toEqual(['in_app'])
    expect(channelsFor('sale', allOff)).toEqual(['in_app'])
  })

  it('per-category opt-out only affects that category', () => {
    const noOrderEmail = { ...DEFAULT_PREFS, email_orders: false }
    expect(channelsFor('shipped', noOrderEmail).sort()).toEqual(['in_app', 'push'])   // orders email off
    expect(channelsFor('sale', noOrderEmail).sort()).toEqual(['email', 'in_app', 'push'])  // sold is its own row
    expect(channelsFor('offer_received', noOrderEmail).sort()).toEqual(['email', 'in_app', 'push']) // offers unaffected
    const noDrops = { ...DEFAULT_PREFS, email_price_drops: false, push_price_drops: false }
    expect(channelsFor('price_drop', noDrops)).toEqual(['in_app'])
  })

  it('a prefs row written before the per-event columns existed still resolves (missing keys ⇒ defaults)', () => {
    const legacy = { email_offers: false, push_offers: true } as Partial<typeof DEFAULT_PREFS>
    expect(channelsFor('offer_accepted', legacy).sort()).toEqual(['email', 'in_app', 'push'])
  })

  it('push opt-out drops push for that category', () => {
    const noMsgPush = { ...DEFAULT_PREFS, push_messages: false }
    expect(channelsFor('message', noMsgPush).sort()).toEqual(['email', 'in_app'])
  })
})
