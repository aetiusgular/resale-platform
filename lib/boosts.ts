/**
 * Boosted posts (paid listing promotion) — pricing + pure helpers.
 * A boost is 100% platform revenue (a standalone Stripe charge, no Connect transfer).
 * Active boosts float a listing to the top of browse, labelled "Promoted", capped per
 * page so the feed stays trustworthy.
 */
export interface BoostPackage {
  key: string
  label: string
  durationDays: number
  amountCents: number
}

/** Fixed packages (figured for launch; adjust freely — single source of truth). */
export const BOOST_PACKAGES: readonly BoostPackage[] = [
  { key: 'spotlight_3', label: '3-day Spotlight', durationDays: 3,  amountCents: 600 },
  { key: 'feature_7',   label: '7-day Feature',   durationDays: 7,  amountCents: 1200 },
  { key: 'premier_14',  label: '14-day Premier',  durationDays: 14, amountCents: 2000 },
]

/** At most this many promoted listings per browse page (trust guardrail). */
export const MAX_PROMOTED_PER_PAGE = 2

export function boostPackage(key: string): BoostPackage | undefined {
  return BOOST_PACKAGES.find((p) => p.key === key)
}

/**
 * Move up to `cap` promoted listings to the front (preserving their relative order),
 * leaving everything else in place. PURE — the browse page calls this AFTER any recs
 * re-ranking so paid placement wins the top slots. Marks nothing; callers read the
 * `promoted` flag they already set.
 */
export function applyBoostOrder<T extends { id: string; promoted?: boolean }>(
  listings: readonly T[],
  cap: number = MAX_PROMOTED_PER_PAGE,
): T[] {
  const promoted: T[] = []
  const rest: T[] = []
  for (const l of listings) {
    if (l.promoted && promoted.length < cap) promoted.push(l)
    else rest.push(l)
  }
  return [...promoted, ...rest]
}
