# USER_FEEDBACK.md
### Structured synthesis of PMF validation round — July 2026
Source: 6 detailed responses + 3 quick notes from industry resellers/buyers (24 contacts total). This file is a build input: every feature decision should trace back to a line here.

---

## 1. Verdict

Genuine validation with pushback — not polite yeses. All 6 detailed respondents would try the platform; several gave conditional commitments. Two premise-level objections surfaced (traffic moat, seller independence) — both are known marketplace risks, not concept killers, but they define the launch strategy: **curated invite-only supply density is the answer to both.**

| Respondent | Signal | Key take |
|---|---|---|
| Fate_archive | Strong yes, detailed | Stays on Grailed only for visibility; prefers Option B; wants dropshippers gone; skeptical of comments |
| Bvug (faulhen) | Premise pushback | Big sellers prefer own site/Instagram; rates "really good" though |
| ummmmmmm_j_i | Yes | "Would definitely join" |
| Crownfoil (buyselldm) | Skeptical yes | "10 people pitched this idea"; hard to take Grailed's share; **$5/yr is too low** |
| J_.pierre | Strong yes + strategy | **$20/yr makes more sense — "Raya of selling apps"**; ban dropshippers/stock-photo slop; premium positioning |
| Maximilian.marco | Yes | Prefers 2% each side; suggests **verified legit-checker roles** |

## 2. Pricing signal (important — contradicts our draft)

The market told us we **underpriced**:
- Crownfoil: $5/yr too low. J_.pierre: $20/yr, position as exclusive/curated ("Raya of selling apps"). Maximilian: 2% each side is best for the company. Fate_archive: B preferred personally, but fine with A if the business needs it.
- **Read:** nobody is price-sensitive at these levels — they're paying 12–25% elsewhere. What they're buying is *curation + moderation*, and a too-cheap membership undermines the exclusivity signal. The membership is a bouncer, not a revenue line.
- **Candidate revision to test in beta:** $20/yr membership (fee-free selling) OR 2%+2% flat — possibly both (membership includes the fee-free tier). Do not ship $5.

## 3. Feature demands (ranked by frequency × intensity)

**P0 — table stakes, build into MVP:**
1. **Duplicate-listing detection & bans** (quick note #2, Fate_archive). Perceptual image hashing on upload; block re-posts of identical photo sets; ban repeat offenders.
2. **Dropshipper / no-item-in-hand exclusion** (Fate_archive, J_.pierre — "2nd arrow" copy-paste stock-photo slop). Proof-of-possession at listing: require one photo with handwritten username+date tag (forum-style), reject stock photos via reverse-image/CV check. This is a *feed quality* feature — "clean feed" was J_.pierre's core want.
3. **Tag/name-abuse detection** (quick note #1) — brand-name keyword stuffing caught in the CV/text pass at listing time.
4. **Manual curation queue** (`is_approved=false` default) during alpha — every listing human-reviewed.

**P1 — differentiators, build during alpha:**
5. **Personalization feed** (quick note #3) — Pinterest/Depop-style discovery; explicitly called out as missing from Grailed+GOAT. This is the buyer-side differentiator; fees are the seller-side one.
6. **Verified legit-checker roles** (Maximilian) — formalize as a badge/tier: vetted users whose LC comments carry authority. Slots into the existing reputation-tier design.

**P2 — revisit before public launch:**
7. Seller storefront identity (Bvug's objection) — big sellers want their own brand. Mitigation: customizable seller pages/verified storefronts so the platform feels like *their* site with shared liquidity.

## 4. Comment section — design change required

Fate_archive (our most engaged respondent) pushed back on the community layer: comments can kill a sale, "reputable" people are often wrong, and disputes should rest only on buyer–seller communication. Maximilian wants LC comments but from *verified* checkers.

**Revised design:**
- Split "legit-check thread" from general comments; LC input restricted to verified legit-checkers + high-tier members in that category.
- **Seller toggle:** sellers can disable general comments per listing (LC thread stays).
- Disputes reference buyer–seller chat only (with consent), never public comments.
- Keep all previous guardrails (ID-verified to comment, rate limits, link blocking, collusion detection).

## 5. Premise risks to carry into strategy

1. **Traffic moat (Crownfoil, Fate_archive):** sellers tolerate Grailed's fees because buyers are there. Low fees alone don't move anyone. Answer: invite-only alpha seeded with archive-grade inventory (the 24-contact list is the seed), quality density over listing count, personalization feed to convert browsers.
2. **Seller independence (Bvug):** top sellers exit to their own sites/IG. Answer: pursue mid-tier and rising sellers first (highest fee pain, no site of their own); storefront features later. Accept that some whales never join.
3. **"10 people pitched this" (Crownfoil):** the idea is common; execution on trust/feed-quality is the differentiator. Ship the anti-slop features first — that's the visible proof.

## 6. Alpha seed list

24 named contacts collected (Tumuhclothes, Buyselldm, Marcosqrd, Blindate, Refffined, Brokeclasps, Shoprokuz, Hedivietnam, Fauhlen, 2ndstreetemployee, Banreps, Sznny, Jadedarchivee, Stevzn, Cowboipunk, Ummmmmm_j_i, Fate_archive_, Thrashhh, Zizekcel, Sparo_stocks, Maximilian.marco, J_.pierre, Crownfoil, Bvug). These are the invite-code wave-1 recipients; the 3–4 strongest yeses get founding-member treatment (input on features, extra invite codes).
