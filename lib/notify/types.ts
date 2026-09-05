// G2 notification domain types (shared client/server-safe).
export type NotifyChannel = 'in_app' | 'email' | 'push'
// Per-event preference buckets (Settings → Notifications rows). 'alerts' is the
// catch-all for platform notices that never get a row of their own.
export type NotifyCategory =
  | 'offers'        // offers on my listings
  | 'offer_result'  // offer accepted / declined / countered
  | 'messages'      // new messages
  | 'sold'          // item sold
  | 'price_drops'   // price drops on saved items
  | 'search_alerts' // saved search alerts
  | 'orders'        // order & shipping updates
  | 'alerts'
export type NotifyEvent =
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'offer_countered'
  | 'sale'
  | 'price_drop'
  | 'listing_approved'
  | 'shipped'
  | 'delivered'
  | 'dispute'
  | 'message'
  | 'tier_expiry'
  | 'saved_search'
  | 'buyer_reward'
  | 'elite_program'
  | 'admin_elite_lead'
  | 'moderator_granted'

export type NotifyContext = {
  actorName?: string       // username that triggered it (buyer/seller/sender)
  itemTitle?: string
  amountCents?: number
  orderId?: string
  listingId?: string
  conversationId?: string
  offerId?: string         // offer_received/countered: lets the notifications popout act inline
  oldAmountCents?: number  // price_drop: the price before the cut
  brand?: string           // price_drop / listing_approved: card sub-line
  preview?: string         // message snippet
  appUrl?: string          // absolute base for email links
  tierSide?: 'buyer' | 'seller'  // tier_expiry: which side's rate is at risk
  fromBps?: number               // tier_expiry: current activity rate (bps)
  toBps?: number                 // tier_expiry: projected rate after roll-off (bps)
  rewardPct?: number             // buyer_reward: discount percent earned
  milestoneLabel?: string        // buyer_reward: the spend milestone reached (e.g. "$1,000")
}

export type NotificationPrefs = {
  email_offers: boolean; push_offers: boolean
  email_offer_result: boolean; push_offer_result: boolean
  email_messages: boolean; push_messages: boolean
  email_sold: boolean; push_sold: boolean
  email_price_drops: boolean; push_price_drops: boolean
  email_search_alerts: boolean; push_search_alerts: boolean
  email_orders: boolean; push_orders: boolean
  email_alerts: boolean; push_alerts: boolean
}

export type RenderedNotification = {
  category: NotifyCategory
  title: string
  body: string
  url: string | null
  email: { subject: string; text: string; html: string }
}
