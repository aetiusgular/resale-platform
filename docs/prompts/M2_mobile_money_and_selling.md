# M2 — Money and selling on iOS

```
READ ONLY (resale-platform): CLAUDE.md, AGENTS.md, docs/MOBILE_PLAN.md, docs/api/openapi.yaml,
docs/HANDOFF.md, app/api/checkout/route.ts, app/api/boosts/route.ts, app/api/orders/**,
app/api/listings/route.ts, app/api/listings/[id]/route.ts, app/api/listings/drafts/route.ts,
app/api/reviews/route.ts, app/api/account/delete/route.ts, app/sell/new/sell-form.tsx (as the
wizard spec), app/orders/[id]/*.tsx (as the order-detail spec), app/checkout/[listingId]/*.tsx.
READ ONLY (archive-ios): CLAUDE.md, docs/HANDOFF.md, docs/ARCHITECTURE.md, Packages/ArchiveCore/**.
PLAN FIRST. Every screen that sends money-affecting requests gets a code-reviewer pass on its
request construction (ids only, never amounts).
```

TASKS

1. **Sell wizard** (all steps, from `sell-form.tsx`): drafts autosave via
   `POST /api/listings/drafts` + `PATCH /api/listings/{id}`; six photo slots through
   `StorageUploader` (`listings/{uid}/{listingId}/{slot}.jpg`, JPEG re-encode ≤ 10 MB, upsert);
   category/subcategory/size/colour/condition/measurements from `lib/taxonomy` and `lib/sizes`
   served by `GET /api/sell/new`; fee box from the server's `sellerBps`/`welcomeSalesRemaining`;
   publish `POST /api/listings`; edit mode; relist. Surface 403 `verification_required` as the
   verify gate.
2. **Checkout**: `GET /api/checkout/preview` for the summary, address picker from
   `GET /api/settings/addresses`, PAY → `POST /api/checkout` → `PaymentSheet` with the client
   secret → poll `GET /api/orders/by-intent` → order detail. Offer-based checkout via `offerId`.
3. **Order detail** with role-aware actions: confirm, ship (carrier + tracking, or `{}` when a
   label exists; show label URL), deliver, dispute (evidence upload to
   `listings/{uid}/dispute-evidence/{orderId}/…` then `POST .../dispute`), review
   (`POST /api/reviews` with tags and photos), timers from the DTO.
4. **Boost**: `GET /api/boosts?listingId=` → packages + free bump; buy via `POST /api/boosts` +
   PaymentSheet.
5. **Connect + Identity**: `POST /api/stripe/connect/link` and `POST /api/idv/start` opened in
   `ASWebAuthenticationSession` with callback scheme `archive`; on return refresh
   `GET /api/settings/profile` / `GET /api/idv/status`.
6. **Community**: LC comments read/post/vote/agree/flag on listing detail (verified members only,
   mirror the web gate), follows on seller + listing, moderator recommend.
7. **Account deletion** flow (`POST /api/account/delete {confirm:'DELETE'}`) then sign out.
8. Backend fixes discovered while wiring go on `feat/mobile-api-2` with the same gates.

ACCEPTANCE: a listing created on iOS appears in `pending_review` on web; a test-mode purchase
on iOS creates an order visible on web and the seller can confirm/ship from iOS; dispute and
review flows complete; `xcodebuild` and `swift test` green; code-reviewer notes attached to the
PR. Then VERIFY → RECORD → DECIDE → `M3`.
