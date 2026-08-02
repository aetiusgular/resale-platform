// G2 notification domain types (shared client/server-safe).
export type NotifyChannel = 'in_app' | 'email' | 'push'
export type NotifyCategory = 'offers' | 'orders' | 'messages' | 'alerts'
export type NotifyEvent =
  | 'offer_received'
  | 'offer_accepted'
  | 'sale'
  | 'shipped'
  | 'delivered'
  | 'dispute'
  | 'message'
  | 'tier_expiry'
  | 'saved_search'

export type NotifyContext = {
  actorName?: string       // username that triggered it (buyer/seller/sender)
  itemTitle?: string
  amountCents?: number
  orderId?: string
  listingId?: string
  conversationId?: string
  preview?: string         // message snippet
  appUrl?: string          // absolute base for email links
  tierSide?: 'buyer' | 'seller'  // tier_expiry: which side's rate is at risk
  fromBps?: number               // tier_expiry: current activity rate (bps)
  toBps?: number                 // tier_expiry: projected rate after roll-off (bps)
}

export type NotificationPrefs = {
  email_offers: boolean; push_offers: boolean
  email_orders: boolean; push_orders: boolean
  email_messages: boolean; push_messages: boolean
  email_alerts: boolean; push_alerts: boolean
}

export type RenderedNotification = {
  category: NotifyCategory
  title: string
  body: string
  url: string | null
  email: { subject: string; text: string; html: string }
}
