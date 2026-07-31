# G9 — follows + reviews (wiring notes)

Pure cores (`lib/reviews/{rating,eligibility}.ts`) + `tests/unit/reviews.test.ts` are done.
This adds the DB + routes + UI. Behind `FOLLOWS_ENABLED` / `REVIEWS_ENABLED`.

## Delivered (verify + commit)
- `supabase/migrations/20240101000020_reviews_follows.sql` — `follows` (RLS client-writable),
  `reviews` (public read, writes only via RPC), `review_direction` enum, and
  `post_review()` SECURITY DEFINER enforcing the same rule as `canLeaveReview`
  (party to a `released` order, one per direction). **db-guard before push.**
- `app/api/reviews/route.ts` — POST → `post_review` RPC, body anti-slop-filtered, P0001
  codes mapped to HTTP. **code-reviewer** (money/reputation-adjacent).
- `app/api/follows/route.ts` — POST follow / DELETE unfollow; RLS-backed; idempotent on 23505.

## Remaining on-computer (UI + helper — needs your pages + ui-verifier)
1. **Seller rating helper** (server): read a seller's received stars and aggregate —
   ```ts
   const { data } = await supabase.from('reviews')
     .select('stars').eq('subject_id', sellerId).eq('direction', 'buyer_to_seller')
   const summary = aggregateRating((data ?? []).map(r => r.stars))  // lib/reviews/rating
   ```
   Render `summary.average` + `summary.count` on the profile + listing cards.
2. **Follow button** on the seller profile — POST/DELETE `/api/follows`, optimistic toggle,
   only when `FOLLOWS_ENABLED`. A "followed sellers" feed = listings where
   `seller_id IN (select following_id from follows where follower_id = me)`.
3. **Review prompt** on a `released` order (buyer + seller each get one) — a stars+body
   form → POST `/api/reviews`; gate the prompt's visibility with `canLeaveReview` so it
   hides once submitted / for non-parties. Only when `REVIEWS_ENABLED`.
4. Feed the seller's aggregate into the **risk gate** (item 4): pass the received stars to
   `sellerRiskFlagged({ ratings, ... })` — this is what unblocks the ratings half.

## Acceptance tests
- Only a `released`-order party can review, once per direction — the RPC raises
  `order_not_completed` / `not_a_party` / `already_reviewed` (→ 409/403/409); a non-party
  and a not-yet-released order are both rejected. (Reuse `reviews.test.ts` for the pure
  layer; add an integration test that calls `post_review` on a non-released order and
  asserts the raise.)
- Aggregate rating on a profile equals `aggregateRating(receivedStars)`.
- Follow is idempotent (second POST still 200, one row); unfollow removes it; self-follow 400.
- `REVIEWS_ENABLED=false` ⇒ POST /api/reviews 404 and the prompt is hidden;
  `FOLLOWS_ENABLED=false` ⇒ follow route 404 and the button hidden.
