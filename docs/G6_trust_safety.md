# G6 — Trust & Safety / moderation ops

Operationalize the moderation signals the platform already produces (phash duplicate
detection, message/comment filters, `listing_flags`, disputes, buyer strikes) into a
console a human can act from — plus the two pure cores now built in `lib/trust/`.

## Already built + verified (cloud, pure logic — on branch)

- `lib/trust/risk-signal.ts` — `evaluateSellerRisk()` / `sellerRiskFlagged()`.
  OR's `ratingsTriggerRisk()` (G9) with an upheld-complaint threshold
  (`COMPLAINT_RISK_THRESHOLD = 2`) and a manual admin override. Returns the firing
  `reasons[]` for the audit log. **This closes the G4 loop**: pass its boolean as
  `riskFlagged` into `sellerRequiresIdVerification(service, sellerId, { riskFlagged })`.
- `lib/trust/prohibited-items.ts` — `scanListing()` → `block` / `review` matches by
  category (counterfeit, weapons, regulated, stolen, gift-card). Narrow `block` tier
  (explicit weapons/ammo only) so streetwear graphic prints are never auto-hidden;
  everything softer is `review`. Starter ruleset — T&S tunes the pattern lists.
- `tests/unit/trust.test.ts` — 13 tests (risk OR-logic, thresholds, block-vs-review,
  the "don't nuke a cannabis-leaf tee" case, evidence capture).

## On-computer build (this is the bulk of G6)

Ordered so each slice is independently verifiable. Every DB change runs **db-guard**;
every action route that touches money/auth/RLS runs **code-reviewer**; console screens
run **ui-verifier**. No user-facing behavior change until reviewed — this is admin-only
surface, so gate it on `profiles.role = 'admin'` exactly like `listing_flags` does.

### 1. Wire the risk orchestrator into the verification gate
- Where a seller lists / requests payout, resolve their signals (trailing ratings via
  `lib/reviews`, upheld-complaint count from disputes/strikes) and call
  `sellerRequiresIdVerification(service, sellerId, { riskFlagged: sellerRiskFlagged(sig) })`.
- code-reviewer (auth gating). No new table needed for the boolean itself.

### 2. Run prohibited-items on listing publish
- In the listing create/update path, call `scanListing()`. On a `block` match →
  hold the listing (don't publish) + write a `listing_flags` row; on `review` →
  publish but flag for the queue. Extend the `listing_flags` `type` CHECK to add
  `'prohibited_block'` / `'prohibited_review'` (migration → db-guard); store the
  matches in the existing `evidence` JSONB.

### 3. Moderation audit log (the spine)
- New migration (db-guard): `moderation_actions` — `id`, `actor_id` (admin),
  `target_type` ('listing'|'user'|'message'|'comment'|'order'), `target_id`,
  `action` ('remove'|'restore'|'warn'|'ban'|'unban'|'refund'|'uphold_complaint'|
  'dismiss'), `reason` TEXT, `evidence` JSONB, `created_at`. RLS: admin SELECT only;
  **service-role writes only** (mirror `listing_flags`). Every action in step 4 writes
  exactly one row here — the log is append-only.

### 4. Action tooling (one endpoint per verb, each writes an audit row)
- `POST /api/admin/moderation/<action>` for remove/restore/warn/ban/unban/refund/
  uphold-complaint/dismiss. Reuse the existing approve/reject pattern in
  `app/admin/queue`. **Refund** must go through the existing money path (Stripe +
  order state machine — never mutate amounts directly); code-reviewer required.
  `uphold_complaint` increments the seller's upheld-complaint count that
  `evaluateSellerRisk` reads (so a sustained complaint can trip verification).

### 5. Console UI (extend `app/admin`)
- Queues: flagged listings (existing), flagged messages/comments (from the filters),
  flagged users (strikes/complaints), prohibited-items review. Each row shows evidence
  + the one-click actions from step 4. ui-verifier on the console screens.

### 6. Prohibited-items ruleset page + appeals inbox
- Surface the `lib/trust/prohibited-items` categories as an editable reference (start
  static). Appeals: a `moderation_appeals` table (db-guard) users can file against an
  action, landing in an admin inbox that can `restore`/`unban` (writing an audit row).

## Acceptance
- Prohibited `block` listing never goes live; `review` listing publishes but queues.
- Every moderator action writes one `moderation_actions` row; refund flows the money
  path and lands the order in the correct state.
- Two upheld complaints (or bad ratings) make `sellerRequiresIdVerification` return
  true. `pnpm verify` green; db-guard on every migration; code-reviewer on refund +
  ban + the verification wiring; ui-verifier on the console.
