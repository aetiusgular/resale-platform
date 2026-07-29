/**
 * Prohibited / restricted item detection — PURE. No DB, no I/O.
 *
 * Scans a listing's text (title / description / category / brand) for prohibited or
 * restricted content, mirroring the regex-array approach of `lib/message-filter.ts`.
 * It returns matches classified into two tiers:
 *
 *   - 'block'  — unambiguous prohibited goods (real weapons / ammunition). Safe to
 *                auto-hide. The block set is deliberately NARROW: this is a
 *                streetwear/fashion marketplace where graphic prints reference all
 *                sorts of things, so we do not auto-block on a word a t-shirt might
 *                print (no bare "gun", "weed", "cannabis" — those go to 'review').
 *   - 'review' — soft signals (counterfeit/replica slang, regulated goods) that a
 *                human moderator should confirm. False positives here are cheap
 *                (a person looks); the cost of a miss is higher, so recall wins.
 *
 * This is a STARTER ruleset. The pattern lists are meant to be tuned by Trust &
 * Safety over time; keep additions in the right tier (precision for 'block',
 * recall for 'review'). Like every regex filter it is context-blind — "not a
 * replica" will match the replica rule — which is exactly why counterfeit signals
 * are 'review', never 'block'.
 */

export type ProhibitedTier = 'block' | 'review'

export type ProhibitedCategory =
  | 'counterfeit'
  | 'weapons'
  | 'regulated'
  | 'stolen'
  | 'currency_giftcard'

export type ListingText = {
  title?: string
  description?: string
  category?: string
  brand?: string
}

export type ProhibitedMatch = {
  category: ProhibitedCategory
  tier: ProhibitedTier
  /** Human-readable reason, suitable for the flag evidence / audit log. */
  label: string
  /** Which listing field the match came from. */
  field: keyof ListingText
  /** The exact substring that matched (for evidence). */
  matched: string
}

type Rule = {
  category: ProhibitedCategory
  tier: ProhibitedTier
  label: string
  pattern: RegExp
}

const RULES: Rule[] = [
  // ── Counterfeit / replica (review — context matters) ───────────────────────
  { category: 'counterfeit', tier: 'review', label: 'replica/counterfeit language', pattern: /\breplica[s]?\b/i },
  { category: 'counterfeit', tier: 'review', label: 'replica/counterfeit language', pattern: /\bcounterfeit[s]?\b/i },
  { category: 'counterfeit', tier: 'review', label: 'knock-off language', pattern: /\bknock[\s-]?off[s]?\b/i },
  { category: 'counterfeit', tier: 'review', label: 'mirror-quality (rep slang)', pattern: /\bmirror\s+quality\b/i },
  { category: 'counterfeit', tier: 'review', label: '1:1 copy (rep slang)', pattern: /\b1:1\b/ },
  { category: 'counterfeit', tier: 'review', label: 'rep-market source', pattern: /\bdh[\s-]?gate\b/i },
  { category: 'counterfeit', tier: 'review', label: 'UA/rep batch (sneaker rep slang)', pattern: /\b(ua|rep)\s+batch\b/i },
  // ── Weapons (block — narrow, explicit terms only) ──────────────────────────
  { category: 'weapons', tier: 'block', label: 'firearm', pattern: /\bfirearm[s]?\b/i },
  { category: 'weapons', tier: 'block', label: 'pistol/handgun for sale', pattern: /\b(pistol|handgun)[s]?\b/i },
  { category: 'weapons', tier: 'block', label: 'ammunition', pattern: /\b(ammunition|ammo)\b/i },
  { category: 'weapons', tier: 'block', label: 'suppressor/silencer', pattern: /\b(silencer|suppressor)[s]?\b/i },
  { category: 'weapons', tier: 'block', label: 'switchblade/butterfly knife', pattern: /\b(switchblade|butterfly\s+knife)[s]?\b/i },
  { category: 'weapons', tier: 'block', label: 'brass knuckles', pattern: /\bbrass\s+knuckles\b/i },
  // ── Regulated / restricted (review) ────────────────────────────────────────
  { category: 'regulated', tier: 'review', label: 'possible controlled substance', pattern: /\b(cocaine|heroin|mdma|ketamine)\b/i },
  { category: 'regulated', tier: 'review', label: 'vape/e-cigarette (age-restricted)', pattern: /\b(vape|e[\s-]?cig(arette)?s?|nicotine)\b/i },
  { category: 'regulated', tier: 'review', label: 'prescription drug reference', pattern: /\b(xanax|adderall|oxycodone|percocet)\b/i },
  // ── Stolen goods (review) ──────────────────────────────────────────────────
  { category: 'stolen', tier: 'review', label: 'possible stolen-goods language', pattern: /\b(stolen|fell\s+off\s+the\s+back\s+of\s+a\s+truck)\b/i },
  { category: 'stolen', tier: 'review', label: 'security tag still attached', pattern: /\bsecurity\s+tag\b/i },
  // ── Currency / gift cards (review — common fraud vector) ────────────────────
  { category: 'currency_giftcard', tier: 'review', label: 'gift card / currency resale', pattern: /\bgift\s?cards?\b/i },
]

const FIELDS: (keyof ListingText)[] = ['title', 'description', 'category', 'brand']

/**
 * Return every prohibited/restricted match across the listing's text fields.
 * Empty array means nothing matched. Each field is scanned against every rule so
 * a single listing can surface multiple categories.
 */
export function scanListing(listing: ListingText): ProhibitedMatch[] {
  const matches: ProhibitedMatch[] = []
  for (const field of FIELDS) {
    const value = listing[field]
    if (!value) continue
    for (const rule of RULES) {
      const m = rule.pattern.exec(value)
      if (m) {
        matches.push({
          category: rule.category,
          tier: rule.tier,
          label: rule.label,
          field,
          matched: m[0],
        })
      }
    }
  }
  return matches
}

/** True if any match is in the 'block' tier — i.e. the listing should be auto-hidden. */
export function isBlocked(listing: ListingText): boolean {
  return scanListing(listing).some((m) => m.tier === 'block')
}

/** The most severe tier present, or null if the listing is clean. */
export function highestTier(listing: ListingText): ProhibitedTier | null {
  const matches = scanListing(listing)
  if (matches.some((m) => m.tier === 'block')) return 'block'
  if (matches.length > 0) return 'review'
  return null
}
