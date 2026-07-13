# FEATURE_SET.md
### Full feature inventory vs. Grailed — what parity requires, what we skip, what we do better
Researched July 2026 from Grailed's product, help center, and third-party seller guides. Legend: **[P]** parity required · **[P+]** parity but ours is better by design · **[Δ]** our differentiator, Grailed lacks it · **[skip]** deliberately not building · Milestones reference PROJECT_PLAN.md (M0–M8, PA = post-alpha).

---

## 1. Discovery & browsing (buyer side)

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Search + filters (brand, size, condition, price, category, design details) | Robust; core of the product | Same set; add condition-score filter (1–10 rubric beats their vague labels) | [P] M4 |
| Sort (price, popularity, newest) | Yes | Same | [P] M4 |
| Saved searches + alerts | Yes — notify on new matches | Same; this is the #1 power-buyer feature, don't defer past beta | [P] PA-1 |
| Price-drop notifications on favorited items | Yes | Same | [P] PA-1 |
| Favorites / wishlist | Yes ("likes") | Same (also feeds Offer-to-Likers) | [P] M4 |
| Follow sellers / designers / searches / collections | Yes — feeds their "For You" feed | Same, plus follow *legit-checkers* (unique to us) | [P] PA-1 |
| Personalized feed | "For You" algorithmic feed (2024+); their answer to Depop/Pinterest | Our P1 differentiator target — quick note #3 says their version still underwhelms; we log events from M4 day one to train ours | [P+] PA-2 |
| Curated categories/taxonomy (Grails/Hype/Sartorial/Core equivalent) | Yes; key to their curation identity | Simpler: curated collections + staff picks during alpha (manual = free) | [P] M4 lite, PA |
| Editorial content (Dry Clean Only) | Yes; brand-building | Skip at launch; community layer partially substitutes | [skip → PA] |
| Cart (multi-item) | Yes (recent addition) | Skip for alpha (single-item checkout); add at beta | [P] PA-2 |

## 2. Transactions & payments

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Buy-now checkout | Yes (PayPal-centric historically, own payments now) | Stripe Connect, escrow-style (funds release on delivery) — stronger than their model | [P+] M5 |
| Offers / binding offers (24h expiry) | Yes; core negotiation mechanic | Same mechanic incl. expiry windows | [P] M6 |
| Offer to Likers (seller-initiated, last 100 likers, 4×/mo) | Yes | Same, simplified limits | [P] M6 |
| BNPL (Affirm/Zip) | Yes | Via Stripe (Affirm/Klarna) — also a revenue line (business-models.md #5) | [P] PA-1 |
| Prepaid shipping labels | Grailed Labels (US/PR, <$750, <20lb; buyer pays shipping) | Same via Shippo/EasyPost — margin is a revenue line | [P] PA-1 |
| Purchase protection | Refund if not received / not authentic / not as described | Same coverage, but escrow makes it structural rather than claims-based — money never left the platform | [P+] M5 |
| Seller payout protection | Via PayPal/processor terms | Stripe Connect + our dispute freeze | [P] M5 |
| Fees | 9% + 3.5–5% processing | 2%+2% flat or membership (D1) — the headline differentiator | [Δ] M5 |

## 3. Trust, authentication & moderation

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Digital authentication (AI scan of keywords/prices/images pre-publish, minutes) | Yes — every listing | Same architecture (CV first pass); alpha = manual review, automate PA | [P] M2 manual, PA auto |
| Human moderator escalation (~50 mods, 24/7, high-risk brands) | Yes | Us two + community during alpha; paid LC network later | [P] M2 |
| "Authenticated" badge on verified listings | Yes | Same + paid authentication certificates for high-value (revenue line) | [P+] PA-1 |
| Trusted-seller program (ID + payment verification, skip moderation queue) | Yes | Ours is universal: *every* seller is ID-verified at signup (D6) — stronger baseline than their opt-in tier | [P+] M1 |
| Seller feedback/ratings + transaction count | Yes | Same + reputation tiers (Bronze→Platinum) with real perks — theirs is display-only | [P+] M2/PA |
| Counterfeit penalty (account freeze) | Yes | Same + tier demotion + paid-membership forfeiture (D1-B makes bans costly) | [P+] M2 |
| Duplicate-listing detection | Weak — top user complaint in our feedback | Perceptual-hash dedupe at upload, cross-account | [Δ] M3 |
| Dropshipper/stock-photo exclusion | Absent — "2nd arrow slop" complaint | Proof-of-possession photo + reverse-image check | [Δ] M3 |
| Community legit-check threads on listings | Absent (moderation is backstage) | Verified-checker LC threads + seller-toggleable comments (D2) | [Δ] M7 |

## 4. Seller tools

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Listing flow (photos, brand/category/size, condition, price) | Standard; vague condition labels | Guided photo templates + auto-tag + 1–10 rubric | [P+] M2 |
| Bump (every 7 days free; after 30 days requires 10% price drop) | Yes — their visibility economy | Free tier-based bumps + optional paid bumps (revenue, business-models.md #7) | [P+] PA-1 |
| Smart Pricing (auto price-drop 10%/wk to floor) | Yes | Same — simple cron job, high seller value | [P] PA-1 |
| Price drop → feed re-ranking | Yes | Same | [P] M4 |
| Seller dashboard (views, likes, conversion) | Basic; third parties sell better ones on Etsy(!) | PostHog-backed seller analytics — cheap for us, loved by power sellers | [P+] PA-1 |
| Vacation/away mode | Yes | Same, trivial | [P] PA-1 |
| Bulk tools / cross-listing API | Weak (third-party ecosystem: Vendoo, Voolist fills gap) | PA; open API later doubles as pro-dealer subscription value | [P] PA-2 |
| Storefront/branding for big sellers | Minimal profiles | Verified storefront pages (Bvug mitigation) | [Δ] PA-2 |

## 5. Communication & community

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Buyer–seller DM on listings | Yes | Same + consent-based dispute transcripts | [P] M6 |
| Public comments on listings | Removed years ago (moderation cost) | Our bet: reinstated with ID-verification guardrails (D2) — the community moat | [Δ] M7 |
| Notifications (push/email: offers, messages, drops, follows) | Yes | Email first (free), push at PA with mobile | [P] M6 lite, PA |
| Mobile apps (iOS core to usage) | Yes — majority of traffic | Alpha = responsive web + PWA; native iOS is a PA-2 must before public launch, not optional — this is the biggest parity gap we consciously carry | [P] PA-2 |

## 6. Platform & operations

| Feature | Grailed today | Ours | Tier |
|---|---|---|---|
| Admin moderation console | Internal | M2 curation queue grows into this | [P] M2+ |
| Fraud/velocity detection (collusion, fake transactions) | Internal | Tier-farming + LC-brigading detection (friend's original spec) | [P] M3/PA |
| Analytics (CTR, funnels, session replay) | Internal | PostHog from day one | [P] M8 |
| SEO listing pages | Strong (large % of their demand is Google) | Next.js SSR from M0 — do not break this; it's how marketplaces get free buyer traffic | [P] M0/M4 |
| Invite/referral system | None (open signup) | Invite codes, 3–5 per member (alpha exclusivity engine) | [Δ] M1 |

---

## Compare & contrast — the honest summary

**Where Grailed is genuinely strong (respect it):** search/filter depth, saved-search alerts, the offer mechanics, SEO-driven buyer traffic, iOS app, and a 50-person 24/7 moderation operation. Parity on the first three is achievable solo; the last three are scale advantages we close over time (SSR from day one, PWA→iOS, community+AI moderation instead of headcount).

**Where Grailed is weak (attack here):** 12–14% effective fees; no duplicate detection (top complaint in our own feedback); dropshipper slop in the feed; display-only reputation; no public community layer (they removed comments; we re-add them with ID-verified guardrails); vague condition labels; big sellers get no storefront identity. Every one of these maps to a validated complaint from USER_FEEDBACK.md.

**What we consciously don't match at alpha:** native mobile apps, cart, editorial, BNPL, shipping labels, saved-search alerts — all PA items. None block a 24-contact curated alpha; all block a public launch. The PA-1 list (saved searches, alerts, labels, bumps, smart pricing, seller dashboard, BNPL) is effectively "the second 12 weeks."

**Revised milestone note:** M4 gains favorites + price-drop re-ranking (cheap, expected); M6 gains offer expiry + Offer-to-Likers (core Grailed mechanics buyers will assume exist). PROJECT_PLAN.md quick-check: no milestone resequencing needed — parity gaps slot into existing PA phases.

## Sources
[Grailed — How to Sell](https://howtosell.grailed.com/) · [Grailed — Digital Verification](https://www.grailed.com/trust/verification) · [Grailed — Seller Verification](https://www.grailed.com/trust/seller-verification) · [Grailed — New Feed](https://www.grailed.com/drycleanonly/your-new-grailed-feed) · [Grailed Support — Verification](https://support.grailed.com/hc/en-us/articles/30283258898189-How-does-Grailed-Verification-work) · [Grailed Support — Offers](https://support.grailed.com/hc/en-us/articles/30298575011085-Offers-for-Buyers) · [Grailed Support — Labels](https://support.grailed.com/hc/en-us/articles/32229125355661-What-are-Grailed-Labels) · [Voolist — Grailed Fees 2026](https://www.voolist.com/blog/grailed-fees-2026) · [Voolist — How to Sell on Grailed 2026](https://www.voolist.com/blog/how-to-sell-on-grailed) · [TopBubbleIndex — How Grailed Works](https://www.topbubbleindex.com/blog/how-grailed-works/) · [TopBubbleIndex — Grailed Authentication](https://www.topbubbleindex.com/blog/grailed-authentication/) · [Vendoo — Getting Started Selling](https://blog.vendoo.co/the-holy-grailed-how-to-get-started-selling-on-grailed) · [OneShop — Grailed Offers](https://tools.oneshop.com/blog/grailed-offers)
