/**
 * Pure feed-ordering helper. Given the platform's default-ordered listings and
 * the recs-engine feed's ranked item_ids, return a NEW array with feed items
 * first (in feed rank order), followed by every remaining listing in its
 * original order. Items in the feed but not on the page are ignored; items on
 * the page but not in the feed keep their default position at the tail.
 *
 * PURE — no I/O. Fail-soft by construction: an empty feed id list returns the
 * input order unchanged, so callers can pass `feed?.items ?? []` safely.
 */
export function applyFeedOrder<T extends { id: string }>(
  listings: readonly T[],
  feedItemIds: readonly string[],
): T[] {
  if (feedItemIds.length === 0) return [...listings]
  const byId = new Map(listings.map((l) => [l.id, l]))
  const rank = new Map<string, number>()
  feedItemIds.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i) // first occurrence wins
  })

  const ranked: T[] = []
  const seen = new Set<string>()
  for (const id of feedItemIds) {
    const item = byId.get(id)
    if (item && !seen.has(id)) {
      ranked.push(item)
      seen.add(id)
    }
  }
  const tail = listings.filter((l) => !seen.has(l.id))
  return [...ranked, ...tail]
}
