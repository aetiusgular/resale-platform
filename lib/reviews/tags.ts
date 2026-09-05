/** "WHAT STOOD OUT" chips on the review form (design: Settings → Orders → Review). PURE. */
export const REVIEW_TAGS = ['AS DESCRIBED', 'FAST SHIPPING', 'GREAT PACKAGING', 'GOOD COMMS'] as const
export type ReviewTag = (typeof REVIEW_TAGS)[number]
export const REVIEW_MAX_BODY = 600
export const REVIEW_MAX_PHOTOS = 3
export const REVIEW_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000
export const RATE_WORDS = ['POOR', 'FAIR', 'GOOD', 'GREAT', 'EXCELLENT'] as const
