/**
 * Saved-search matcher — PURE. Decides whether an active listing matches a saved
 * search's stored filter, i.e. whether that saved search should alert on this listing.
 *
 * Mirrors the browse filter semantics (app/api/browse/route.ts) so a match here means
 * the listing would appear in that search's results. The saved `query` is the
 * Record<string,string> persisted by POST /api/saved-searches — the same param strings
 * the browse UI sets: `min_price`/`max_price` in DOLLARS, `cond` a minimum condition
 * score, `dropped`/`verified` the string '1'. Absent or empty keys impose no constraint.
 *
 * NOTE on `q`: browse uses Postgres full-text (websearch over a tsvector). This pure
 * matcher approximates it with a case-insensitive token-substring test over
 * title+brand+category+department — right for cheap in-memory pre-filtering across many
 * saved searches, but not a byte-exact FTS replica (no stemming/ranking). If exact
 * parity matters, the G2 dispatch can confirm a q-hit with a scoped DB textSearch. Every
 * OTHER filter matches browse exactly.
 */

export interface MatchableListing {
  status: string
  title: string
  brand: string
  category: string
  department: string
  size: string
  condition_score: number
  price_cents: number
  is_price_dropped: boolean
  /** profiles.id_verification_status === 'verified' */
  seller_verified?: boolean
}

export type SavedSearchQuery = Record<string, string>

function field(query: SavedSearchQuery, key: string): string {
  const v = query[key]
  return typeof v === 'string' ? v.trim() : ''
}

function matchesText(q: string, listing: MatchableListing): boolean {
  const haystack =
    `${listing.title} ${listing.brand} ${listing.category} ${listing.department}`.toLowerCase()
  // websearch AND semantics, approximated: every token must appear as a substring.
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token))
}

/**
 * True iff `listing` satisfies every constraint in `query`. Only `active` listings can
 * match — a saved search never surfaces draft/sold/removed items.
 */
export function matchesSavedSearch(listing: MatchableListing, query: SavedSearchQuery): boolean {
  if (listing.status !== 'active') return false

  const dept = field(query, 'dept')
  if (dept && listing.department !== dept) return false

  const cat = field(query, 'cat')
  if (cat && listing.category !== cat) return false

  const size = field(query, 'size')
  if (size && listing.size !== size) return false

  const brand = field(query, 'brand')
  if (brand && !listing.brand.toLowerCase().includes(brand.toLowerCase())) return false

  const minRaw = field(query, 'min_price')
  if (minRaw) {
    const minCents = Math.round(parseFloat(minRaw) * 100)
    if (Number.isFinite(minCents) && listing.price_cents < minCents) return false
  }
  const maxRaw = field(query, 'max_price')
  if (maxRaw) {
    const maxCents = Math.round(parseFloat(maxRaw) * 100)
    if (Number.isFinite(maxCents) && listing.price_cents > maxCents) return false
  }

  const condRaw = field(query, 'cond')
  if (condRaw) {
    const condMin = parseInt(condRaw, 10)
    if (Number.isFinite(condMin) && listing.condition_score < condMin) return false
  }

  if (field(query, 'dropped') === '1' && !listing.is_price_dropped) return false
  if (field(query, 'verified') === '1' && listing.seller_verified !== true) return false

  const q = field(query, 'q')
  if (q && !matchesText(q, listing)) return false

  return true
}

/**
 * Distinct user ids whose saved searches match this listing — the recipients of a
 * saved-search alert. PURE. The seller is excluded (never alert someone about their own
 * listing), and a user with several matching searches is notified once (Set-deduped).
 */
export function selectAlertRecipients(
  listing: MatchableListing,
  savedSearches: ReadonlyArray<{ user_id: string; query: SavedSearchQuery }>,
  sellerId: string,
): string[] {
  const recipients = new Set<string>()
  for (const s of savedSearches) {
    if (s.user_id === sellerId) continue
    if (recipients.has(s.user_id)) continue
    if (matchesSavedSearch(listing, s.query)) recipients.add(s.user_id)
  }
  return [...recipients]
}
