/**
 * Comment body filtering — same pipeline as message-filter.ts.
 * Applied server-side in the API route before calling post_comment() RPC.
 * Redacted body is stored in the DB; redacted=true flag triggers the design
 * system line "link removed — off-platform payment offers violate policy."
 */
import { filterMessage, FilterResult } from './message-filter'

export type { FilterResult }

/** Body stored when a comment is redacted. Matches the design export (1d). */
export const COMMENT_REDACTION_BODY =
  '[link removed — off-platform payment offers violate policy]'

/**
 * Filter a comment body. Reuses the full filterMessage pipeline (URL blocking
 * + payment-app patterns). Returns filtered body + redacted flag.
 */
export function filterComment(body: string): FilterResult {
  return filterMessage(body)
}
