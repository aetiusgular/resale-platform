/**
 * Message content filtering for chat.
 * Extends the listing anti-slop patterns with URL and off-platform payment detection.
 * Call filterMessage() server-side before calling the send_message() RPC.
 */
import { ANTISLOP } from './antislop-config'

/** Replacement body stored when a message is redacted. */
export const REDACTION_BODY =
  '[link removed — off-platform payment offers violate policy]'

/**
 * Additional patterns specific to chat messages.
 * These are on top of ANTISLOP.BLOCKED_PATTERNS (which already catches
 * telegram, whatsapp, cashapp, venmo, paypal F&F, wire transfer).
 */
const MESSAGE_EXTRA_PATTERNS: RegExp[] = [
  // Generic URL detector — catches http/https links and bare domain.tld/path
  /https?:\/\/\S+/i,
  /\bwww\.\S+\.\S+/i,
  // Payment-app handles and shortlinks not in listing patterns
  /paypal\.me\//i,
  /paypal\.com\/send/i,  // paypal.com/send/... shortlinks
  /cash\.app\//i,
  /\bzelle\b/i,
  /venmo\.com\//i,
  /\bwhatsapp\b/i,   // belt-and-suspenders (already in ANTISLOP)
  /\btelegram\b/i,   // belt-and-suspenders
]

const ALL_MESSAGE_PATTERNS = [
  ...ANTISLOP.BLOCKED_PATTERNS,
  ...MESSAGE_EXTRA_PATTERNS,
]

export interface FilterResult {
  redacted: boolean
  body: string
}

/**
 * Check a message body against all blocked patterns.
 * Returns the (possibly replaced) body and whether it was redacted.
 */
export function filterMessage(body: string): FilterResult {
  for (const pattern of ALL_MESSAGE_PATTERNS) {
    if (pattern.test(body)) {
      return { redacted: true, body: REDACTION_BODY }
    }
  }
  return { redacted: false, body }
}
