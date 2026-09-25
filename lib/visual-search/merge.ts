/**
 * Visual search result merge — PURE. Combines the two signals into one tiered answer:
 *
 *   - the HASH tier from Postgres (`similar_image_hashes` RPC): Hamming distance between the
 *     query's 16x16 blockhash and every live listing photo's hash. A distance at or under
 *     `exactHamming` means "the same photo, re-uploaded" and is `exact` no matter what the
 *     embedding says (it is the stricter, cheaper signal).
 *   - the EMBEDDING tiers from recs-engine (`POST /v1/search/image`): one grouped ANN query
 *     over per-photo fashion-CLIP vectors read at two thresholds → exact / match / close.
 *
 * A listing appears ONCE, in its best tier, ordered by score within the tier. `listed` is
 * true when anything landed in exact or match; the UI leans on it for the "not listed"
 * state, which is the common case at launch.
 */

export type VisualTier = 'exact' | 'match' | 'close'

/** One row of the `similar_image_hashes` RPC. */
export interface HashHit {
  listing_id: string
  slot: string
  distance: number
}

/** One result of the engine response (subset the platform needs). */
export interface EngineResult {
  listing_id: string
  photo_index: number
  score: number
  tier: VisualTier
}

export interface EngineVisualResponse {
  listed: boolean
  query_category: string | null
  /** 'explicit' when the caller filtered, 'guess' when the engine's zero-shot guess did. */
  category_source?: 'explicit' | 'guess' | null
  /** The typed text the engine fused into the close-tier query; null when it ignored it. */
  query_text?: string | null
  results: EngineResult[]
  counts: Record<VisualTier, number>
  thresholds: { exact_cos: number; match_cos: number }
  space_version?: string | null
}

export interface MergedHit {
  listing_id: string
  tier: VisualTier
  /** Cosine score from the engine (null when only the hash tier saw the listing). */
  score: number | null
  /** Hamming distance from the hash tier (null when only the engine saw the listing). */
  hamming: number | null
  /** Index into `listings.images` of the best-matching photo (from the engine or the hash slot). */
  photo_index: number | null
  source: 'hash' | 'engine' | 'both'
}

export interface MergedVisualResults {
  listed: boolean
  category: string | null
  category_source: 'explicit' | 'guess' | null
  text: string | null
  exact: MergedHit[]
  match: MergedHit[]
  close: MergedHit[]
  engine: 'ok' | 'unavailable'
}

const TIER_RANK: Record<VisualTier, number> = { exact: 0, match: 1, close: 2 }

/** `image_hashes.slot` → listings.images index (PHOTO_n → n-1; legacy FRONT…FLAW → 0…4). */
export function photoIndexFromSlot(slot: string): number | null {
  const m = /^PHOTO_(\d+)$/.exec(slot)
  if (m) return Number(m[1]) - 1
  const legacy = ['FRONT', 'BACK', 'TAG', 'DETAIL', 'FLAW'].indexOf(slot)
  return legacy >= 0 ? legacy : null
}

function betterTier(a: VisualTier, b: VisualTier): VisualTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b
}

export function mergeVisualResults(input: {
  hashHits: HashHit[]
  engine: EngineVisualResponse | null
  exactHamming: number
}): MergedVisualResults {
  const byListing = new Map<string, MergedHit>()

  // Hash tier first: the nearest slot per listing wins.
  for (const hit of input.hashHits) {
    if (hit.slot === 'POSSESSION') continue // proof photos are never public; never a "match"
    const tier: VisualTier = hit.distance <= input.exactHamming ? 'exact' : 'close'
    const existing = byListing.get(hit.listing_id)
    if (existing && existing.hamming !== null && existing.hamming <= hit.distance) continue
    byListing.set(hit.listing_id, {
      listing_id: hit.listing_id,
      tier: existing ? betterTier(existing.tier, tier) : tier,
      score: existing?.score ?? null,
      hamming: hit.distance,
      photo_index: photoIndexFromSlot(hit.slot) ?? existing?.photo_index ?? null,
      source: existing?.source ?? 'hash',
    })
  }

  // Embedding tiers: one row per listing already (the engine groups by listing).
  for (const r of input.engine?.results ?? []) {
    const existing = byListing.get(r.listing_id)
    if (!existing) {
      byListing.set(r.listing_id, {
        listing_id: r.listing_id,
        tier: r.tier,
        score: r.score,
        hamming: null,
        photo_index: r.photo_index,
        source: 'engine',
      })
      continue
    }
    byListing.set(r.listing_id, {
      ...existing,
      tier: betterTier(existing.tier, r.tier),
      score: existing.score === null ? r.score : Math.max(existing.score, r.score),
      // the engine's photo is the semantically closest one; keep the hash slot only when
      // the hash tier alone made the listing exact
      photo_index:
        existing.tier === 'exact' && r.tier !== 'exact' ? existing.photo_index : r.photo_index,
      source: 'both',
    })
  }

  const buckets: Record<VisualTier, MergedHit[]> = { exact: [], match: [], close: [] }
  for (const hit of byListing.values()) buckets[hit.tier].push(hit)
  // exact: hash-verified hits first (nearest first), then engine-only exacts by score;
  // match / close: score desc, hash-only hits (no score) last.
  const byHammingThenScore = (a: MergedHit, b: MergedHit) => {
    const ha = a.hamming ?? Number.POSITIVE_INFINITY
    const hb = b.hamming ?? Number.POSITIVE_INFINITY
    if (ha !== hb) return ha - hb
    return (b.score ?? -1) - (a.score ?? -1)
  }
  const byScore = (a: MergedHit, b: MergedHit) => (b.score ?? -1) - (a.score ?? -1)
  buckets.exact.sort(byHammingThenScore)
  buckets.match.sort(byScore)
  buckets.close.sort(byScore)

  return {
    listed: buckets.exact.length + buckets.match.length > 0,
    category: input.engine?.query_category ?? null,
    category_source: input.engine?.query_category ? (input.engine.category_source ?? null) : null,
    text: input.engine?.query_text ?? null,
    exact: buckets.exact,
    match: buckets.match,
    close: buckets.close,
    engine: input.engine ? 'ok' : 'unavailable',
  }
}
