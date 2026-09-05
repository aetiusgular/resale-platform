/**
 * Help & FAQ copy — the single source for /help and GET /api/content/help.
 * Numbers come from the lib constants so the copy can never drift from the money/time rules.
 */
import { DISPUTE_WINDOW_HOURS } from '@/lib/orders'
import { WELCOME_SALES } from '@/lib/fees'

export type HelpFaq = { topic: string; q: string; a: string }

export function helpFaqs(): HelpFaq[] {
  return [
    { topic: 'ESCROW & PAYOUTS', q: 'How does escrow work?', a: `Your payment is held by ARCHIVE until you confirm the item arrived as described. Sellers ship within 3 days on prepaid labels; funds release on your confirmation or ${DISPUTE_WINDOW_HOURS} hours after tracked delivery.` },
    { topic: 'BUYING', q: 'What does the condition score mean?', a: 'Every listing is graded 1–10 against a fixed rubric — 10 is dead-stock with tags, 7 is gently used with light wear, anything under 5 must photograph its flaws.' },
    { topic: 'BUYING', q: 'How do offers and counters work?', a: 'Send an offer from the listing; the seller can accept, decline, or counter once. Accepted offers lock the price and jump straight to checkout.' },
    { topic: 'BUYING', q: 'Is there a buyer fee?', a: 'No. The total at checkout is the item price plus shipping and tax — nothing else.' },
    { topic: 'SELLING', q: 'When do sellers get paid?', a: `Escrow releases to your Stripe Express balance when the buyer confirms delivery, or automatically ${DISPUTE_WINDOW_HOURS} hours after tracking shows delivered.` },
    { topic: 'SELLING', q: 'What does it cost to sell?', a: `Your first ${WELCOME_SALES} sales carry 0% commission — you cover only card processing. After that your rate is set by your tier, shown live before you publish; the full schedule is on the Fees page.` },
    { topic: 'SELLING', q: 'Why is my listing “in review”?', a: 'Every listing is checked by a moderator before it goes live — usually under 24 hours. Tag, detail and possession photos are what get it approved quickly.' },
    { topic: 'LEGIT CHECK', q: 'Who can post a legit check?', a: 'Any verified member can comment and cast one LEGIT or FLAG vote per listing; moderators sign the verdict, which stays pinned on the listing.' },
    { topic: 'ESCROW & PAYOUTS', q: 'How do I open a dispute?', a: `From the order page, within ${DISPUTE_WINDOW_HOURS} hours of delivery. Attach photos, a moderator reviews both sides, and escrow holds until it resolves.` },
    { topic: 'ACCOUNT', q: 'Can I change my username?', a: 'Yes — once every 30 days, from Settings → Profile.' },
    { topic: 'ACCOUNT', q: 'How do I delete my account?', a: 'Settings → DELETE ACCOUNT… Open orders finish first; listings, saves and personal details are removed right away and the order ledger is anonymised.' },
  ]
}
