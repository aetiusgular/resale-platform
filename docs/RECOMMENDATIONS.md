# RECOMMENDATIONS.md — vision-first personalization spec (post-alpha)

## Why Grailed's recommendations are beatable
Grailed's "For You" is brand/category echo: look at three Rick Owens listings,
get a wall of Rick Owens. No concept of ERA (2004 Hedi-era vs 2023 reissue =
"same brand"), no designer adjacency (Margiela archive heads obviously want
Raf redux and JPG), no aesthetic/fit understanding (boxy '90s workwear vs slim
y2k denim are just "bottoms"). It reads metadata; it never LOOKS at the item.

## Core thesis: the image is the primary signal
Fashion taste is visual. Sellers under-describe ("black jacket, sz 48") and
titles lie; the photo carries silhouette, palette, texture, hardware, era
cues, styling context. We already force high-quality structured photos (six
labeled slots incl. TAG and DETAIL close-ups) for authentication — the same
assets power recommendations for free. Text/attributes are the supporting
signal; vision is the lead.

## What we extract from images (the "compiling context" pipeline)
Runs at listing-approval time (approved listings only — pennies each):
1. **Visual embedding** (CLIP-class model): FRONT photo primary + DETAIL
   blended → `listing_embeddings.image_vec`. This is the backbone of
   similarity, feed retrieval, and taste vectors.
2. **VLM attribute read** (multimodal model, one call per listing): returns
   suggested aesthetic tags (from our 30-tag taxonomy), fit/silhouette,
   dominant palette, fabric/texture guess, era cues (label typography on the
   TAG photo, hardware style, wash patterns — the TAG slot is gold: brand
   label eras are visually datable). Suggestions PRE-FILL the listing form
   for seller confirmation — human-in-the-loop keeps data clean.
3. **Cheap classical features** (sharp, already installed): dominant color
   swatches per listing → palette matching ("more in this colorway"),
   background-noise score (feeds curation quality bar).

## Signal model (weights, ~30-day decay)
purchase 10 · offer 6 · save 4 · dwell >20s 2 · click 1 ·
visual-similar click ("more like this") 1.5 ·
negative: quick-bounce −0.5 · "not my style" hide −4 · explanation-chip ✕ −2.

---

## Phase R0 — attributes + adjacency (one build prompt, no ML infra)
Era/year fields in sell flow (heuristics suggest from title: "AW03", "2004");
30-tag aesthetic taxonomy + fit/silhouette selects; designer adjacency graph
`designer_edges` (curated seed: Rick↔Julius↔Boris; Margiela↔MM6↔JPG↔Raf;
Yohji↔Issey↔CDG… + nightly co-save updates); SQL-scored FOR YOU tab
(brand 1.0 / adjacent 0.6×w / era±1 0.8 / tag overlap 0.7 / fit 0.5; size
hard-filter; diversity cap 3/brand/page). Sharp palette extraction ships
here too (no API needed).

## Phase R1 — vision backbone (pgvector)
1. pgvector on; `listing_embeddings(listing_id, image_vec vector, text_vec
   vector)`. Image embedding at approval (Replicate/HF CLIP endpoint or
   equivalent); text embedding of "{brand} {title} {era} {tags} {fit}".
   **Blend 70/30 image/text** — image leads.
2. **"MORE LIKE THIS" module on every listing page** (pure visual ANN,
   ships the moment embeddings exist — zero personalization needed, instant
   user value, and its clicks are high-quality taste signals).
3. VLM attribute pre-fill wired into the approval pipeline (§ above) —
   backfills era/tags for lazy sellers, which also makes R0 scoring better.
4. **User taste = 2–3 visual cluster centroids** (k-means over engaged
   items' image_vecs, signal-weighted, time-decayed; nightly pg_cron +
   in-session updates). Multiple centroids because people run multiple
   wardrobes — one average turns gorpcore+opium into mush.
5. Feed: ANN (HNSW) per centroid, hard-filtered by MY SIZES/price, MMR
   diversity re-rank, freshness + verified boost.
6. **Visual onboarding taste picker**: 12 image tiles (one per aesthetic
   cluster from seed listings), selections initialize centroids. Picker is
   images-only — no words — because users can't name their aesthetic but
   recognize it instantly.
7. Explanation chips from the matched centroid's dominant attributes
   ("because you saved three '90s Yohji pieces"); chip ✕ = negative signal.

## Phase R2 — behavioral graph (when DAU justifies)
Item-item co-engagement; visual-cluster trend surfacing ("archive denim is
moving this week"); sequence models only if R1 plateaus. No speculative infra.

## Evaluation
PostHog funnels live since B4: feed CTR, save/impression, offer/session,
"more like this" engagement. A/B: R0 vs recency; R1 vs R0. Guardrail:
brand-diversity of engaged items must WIDEN — Grailed's failure mode is
collapse into a mirror.

## Build plan
- **BR1**: R0 + sharp palettes + hide control (buildable today).
- **BR2**: pgvector + image/text embedding pipeline + MORE LIKE THIS.
- **BR3**: VLM attribute pre-fill in approval flow.
- **BR4**: taste centroids + personalized feed + visual taste picker + chips.
Standard loop per prompt (plan on fable → sonnet → verify → reviewers).
BR2's MORE LIKE THIS is the highest value-per-effort item in the whole
roadmap — visual similarity is useful at even 100 listings; personalization
(BR4) wants several hundred+ and real engagement data first.
