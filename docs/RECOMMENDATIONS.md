# RECOMMENDATIONS.md — personalization spec (post-alpha, PA-2 → now prioritized)

## Why Grailed's recommendations are beatable
Grailed's "For You" is brand/category echo: look at three Rick Owens listings,
get a wall of Rick Owens. It has no concept of ERA (a 2004 Hedi-era piece vs a
2023 reissue are "the same brand"), no designer-adjacency (someone deep in
Margiela archive obviously wants Raf redux and JPG, but those are "different
brands"), and no aesthetic/fit understanding (boxy '90s workwear vs slim y2k
denim are just "bottoms"). Users experience it as a mirror, not a curator.

## Our structural advantage
We capture data Grailed doesn't have: a 1–10 condition rubric, six labeled
photo slots (incl. TAG close-ups — era-datable), LC threads full of expert
text about the item, and PostHog behavioral events flowing since B4
(product_clicked, listing_saved, filter_applied, search_performed, dwell).

## Signal model (weights, decayed ~30-day half-life)
purchase 10 · offer made 6 · save 4 · dwell >20s 2 · click 1 ·
negative: quick-bounce (<3s) −0.5, "not my style" hide −4 (add hide control).

---

## Phase R0 — attribute enrichment (no ML, ships in one build prompt)
1. **Era/year**: add optional `year` + `era` (enum: 80s/90s/y2k/00s/10s/
   modern) to sell flow DETAILS; heuristic extraction from title ("2004",
   "AW03", "FW19") as suggestion; LC-thread mentions can refine later.
2. **Aesthetic taxonomy** (controlled, ~30 tags, multi-select at listing,
   suggested by keyword heuristics): archive, avant, opium/rick-adjacent,
   workwear, gorpcore, y2k, minimal, military, americana, punk, ivy/prep,
   raw-denim, tech, romantic/poet, grunge, streetwear-hype, sartorial…
3. **Fit/silhouette** (single-select): boxy, oversized, slim, flared,
   cropped, longline, structured, draped.
4. **Designer adjacency graph**: `designer_edges(brand_a, brand_b, weight)`
   seeded from a curated matrix (Rick↔Julius↔Boris B0P; Margiela↔MM6↔JPG↔
   Raf; Yohji↔Issey↔CDG; Chrome Hearts↔vintage silver; etc.), then updated
   nightly from co-save counts (users who saved A also saved B).
5. **R0 feed** ("FOR YOU" tab on /browse): score = Σ signal_weight ×
   attribute_match, where match spans brand (1.0), adjacent brand (0.6 ×
   edge weight), era ±1 bucket (0.8), aesthetic tag overlap (0.7/tag),
   fit (0.5), size match (hard filter via MY SIZES), freshness boost,
   diversity cap (max 3 per brand per page). Pure SQL — no infra.

## Phase R1 — taste vectors (pgvector, still Supabase-native)
1. Enable pgvector. `listing_embeddings(listing_id, embedding vector(768))`.
2. Embed each active listing: text embedding of
   "{brand} {title} {era} {aesthetic tags} {fit} {category}" (cheap API
   call at listing-approval time); OPTIONAL upgrade: CLIP image embedding
   of the FRONT photo, stored separately, blended 60/40 text/image.
3. **User taste vector** = signal-weighted, time-decayed centroid of
   engaged listings' embeddings; recompute nightly (pg_cron) + on-session
   incrementally. Store 2–3 CLUSTER centroids per user (k-means over their
   engaged items) — people have multiple wardrobes; one centroid averages
   a gorpcore + opium user into mush. Serve from each cluster
   proportionally.
4. Feed = ANN search (HNSW) per cluster centroid, hard-filtered by size/
   price ceiling, MMR re-rank for diversity, freshness + verified boost.
5. **Explanation chips** on cards: "because you saved three '90s Yohji
   pieces" — computable from the matched cluster's top attributes; builds
   trust and invites correction (chip ✕ = negative signal).
6. Cold start: onboarding taste picker — 12 image tiles (one per aesthetic
   cluster, from seed listings); selections initialize the taste vector;
   MY SIZES already captured at onboarding.

## Phase R2 — behavioral graph (when DAU justifies)
Item-item co-engagement ("savers of X also bought Y") computed nightly;
session-sequence model (next-item prediction) only if R1 metrics plateau;
two-tower retrieval only at real scale. Do not build speculatively.

## Evaluation
PostHog funnels already live: feed CTR, save-per-impression, offer-per-
session, session depth. Ship R0 vs recency-feed as an A/B flag; R1 vs R0
likewise. Guardrail metric: brand-diversity of engaged items (the Grailed
failure mode is collapsing diversity — our system should widen taste, not
narrow it).

## Build plan
- **BR1** (one prompt): R0 complete — schema, sell-flow fields, taxonomy,
  adjacency seed, SQL feed + FOR YOU tab, backfill script for the 30
  fixtures, A/B flag. 
- **BR2**: pgvector + embedding pipeline + nightly jobs.
- **BR3**: clustered taste vectors, ANN feed, explanation chips, taste
  picker onboarding step.
Each follows the standard loop (spec → plan on fable → sonnet → verify →
reviewer passes). BR1 is buildable today; BR2/3 want ≥several hundred real
listings before embeddings earn their cost.
