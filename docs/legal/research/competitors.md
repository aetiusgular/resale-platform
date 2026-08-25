# Competitor ToS distillation — C2C secondhand fashion marketplaces

Prepared for drafting our ToS + Privacy Policy (CA C-corp, Stripe Connect, ~3-day post-delivery
escrow release, moderator Legit Check threads + planned automated counterfeit screening, paid
boosts, prepaid labels, ML personalization).

**Capture caveats (be honest with counsel):**
- Grailed ToS capture truncated at ~62% (ends mid "Payments and Billing"). Missing: disclaimers,
  LoL, indemnity, DMCA, termination, and the full §20 arbitration text (only the front-of-doc
  arbitration notice was captured).
- Poshmark ToS ~93% captured (cuts off at §18(a) heading "Trade and Economic Sanctions and
  Export Controls"; §19–20 headings known from TOC).
- **Poshmark Privacy Policy capture FAILED** — the /privacy URL re-served the ToS text (SPA did
  not swap content). Section below documents what is known; re-capture needed.
- Depop: the **full July 2026 ToS (§1–22) is complete**; truncation only cut the appended older
  March 2026 version.
- Vestiaire Buyer T&C (Feb 20, 2025): complete. Vestiaire Seller T&C (Mar 9, 2026): captured
  through §11.1; later sections (returns detail, likely account-suspension §13, misc/governing
  law) truncated.

---

## Grailed ToS (grailed.com/about/terms — Grailed, LLC)

**Section outline** (headings unnumbered in doc; capture order):
1. What is Grailed? (intro, defined terms) · 2. Accepting the ToS (+ ALL-CAPS arbitration notice
pointing to §20) · 3. Who Can Use Grailed? (age 16+, 18 in China; on-behalf-of; US embargo/SDN)
· 4. Accounts and Account Security (Persona ID verification) · 5. Additional Terms and
Modifications · 6. Services Generally (license to you; Inherent Risk; Off-Site Activity) ·
7. Seller Terms (listings; offer/acceptance; commission + processing fees; shipping; payouts &
refunds; seller promotions; seller-initiated refunds; seller verification; buyer data) · 8. Buyer
Terms (responsibilities; purchase conditions; binding purchase; listing disclaimers; shipping;
Returns/Purchase Protection; delivery fulfillment; promo codes) · 9. User Content (+ license;
sharing; public account info) · 10. Feedback · 11. Trademarks · 12. Prohibited Conduct (conduct
+ content + enforcement + parental controls) · 13. Third-Party Content · 14. Payments and Billing
(payment processors; taxes; Canada GST/HST agency election; modifications/holds) ·
[TRUNCATED — §§ through 20 incl. arbitration not captured]

**Marketplace role:** contract is directly between users; "Grailed is not a party to such sale
or purchase"; "does not have or take title to any Products"; buyers/sellers "bear all of the
risks." A dedicated "Inherent Risk" clause plus an "Off-Site Activity" clause (off-platform deals
get zero protection; grounds for termination; fee circumvention named).

**Fees:** No percentages in the ToS. Commission on total transaction amount (incl. shipping
unless Grailed Labels, excl. tax) + separate payment-processing fee on total incl. shipping+tax.
"Commission rates are subject to change at our sole discretion, upon notice to you"; processing
fee modifiable "at any time." Rates live on a help page ("Click here for more information").

**Payments/escrow/protection:** Third-party Payment Processors (PayPal + others; Grailed can
require a specific one; holds crediting until seller onboards). Ship within 7 calendar days (2
for Expedited) or the order auto-cancels with buyer refund and no seller credit. **Payout: seller
credited (price − tax − commission − label − fees) "no later than three (3) calendar days after
the tracking information indicates that the Product has been delivered"** — with express carve-out
to hold longer to verify delivery, resolve a buyer claim, or comply with law. This is the closest
analog to our ~3-day escrow — copy the carve-out list. Returns: "All purchases are final" except
as allowed by sellers, Grailed, or law. Purchase Protection: buyer must report a
not-as-described issue **within 3 calendar days of tracked delivery**; ALL-CAPS: no "item not
delivered" claims where carrier tracking confirms delivery to the checkout address; remedies at
Grailed's sole discretion (route to seller, route to processor dispute, or refund after
investigation; may require item shipped to Grailed or seller). "Delivery Fulfillment": carrier
confirmation to the provided address = transaction "completed and fulfilled"; buyer owns address
accuracy. Chargebacks/not-fulfilled: seller must fully refund (incl. shipping + customs); Grailed
may refund and auto-debit seller (with consent baked in), create a debt, freeze cashout, use
collection agencies. Rejected customs returns → seller "relinquish[es] all right, title, and
interest" to Grailed.

**Authentication:** No legit-check program terms in the captured text. Disclaimers instead:
seller reps "you will not list or sell any counterfeit Products"; buyer side: "we do not
guarantee the existence, quality, safety or legality of the Products." (Grailed's digital/
moderator authentication program, if any, is not in this capture — don't cite it.)

**Prohibited items/counterfeits:** counterfeit ban lives in the seller reps + Prohibited Conduct
(IP infringement); no in-ToS prohibited-items list (Code of Conduct linked). Notably modern
prohibitions: scraping incl. "artificial intelligence or machine learning systems (including
large language models)"; **ban on AI-powered purchasing agents/auto-checkout "without direct
human initiation and review of each transaction"**; third-party tools/extensions need written
consent; robots.txt compliance.

**UGC/IP license:** perpetual, irrevocable, nonexclusive, royalty-free, worldwide, sublicensable,
"in all media formats and channels, and for all purposes, including advertising" **plus an
express grant "to perform automated scanning of the User Content to improve targeted searching
and advertising"** — the nearest any of the four gets to an ML-use grant. Product Listings may be
reused by Grailed and by buyers for relisting. Detailed public-vs-private account-data clause
(what's always public, public-by-default-but-toggleable, private-by-default) with a
confidentiality waiver. Feedback: unrestricted use. DMCA: not in captured portion.

**Promoted listings:** none (its "Seller Promotions" = seller-run discounts; "we cannot guarantee
specific advertising or search result placement").

**Dispute resolution:** front-of-doc notice only: mandatory binding **individual** arbitration
"to the extent legally allowed in your jurisdiction," class waiver, jury waiver, **opt-out
mechanism per §20 instructions**. Provider (AAA/JAMS), window length, small-claims and
mass-arbitration text not captured (truncated). Governing law not captured.

**INFORM Consumers Act:** not named. Functional equivalent: "federal and state laws require
Grailed to obtain certain information on sellers" (full legal name, home address, gov-ID match
via **Persona**); failure → suspension **and cashout freeze**; tax-info failure likewise.

**International:** embargoed-country/SDN users barred from transactions. Buyer bears customs
duties; carriers may collect duties + personal info (e.g., SSN) **after checkout**; Grailed may
be unable to estimate duties at checkout. Seller must provide accurate Country of Origin,
declared value, item classification.

**Suspension/funds:** suspend/terminate account (and affiliate accounts), freeze cashout, remove
content "for any reason at our discretion," incl. failed Persona verification or missing tax
info; account non-transferable; terminable on death/incapacity.

**Worth emulating:** (1) plain-English side summaries with an express "summaries are not part of
the Terms" disclaimer; (2) the payout clause pattern — fixed 3-day-post-delivery credit with an
enumerated hold carve-out (delivery verification / open claim / legal requirement) — exactly our
escrow model; (3) Off-Site Activity clause (protects fees + scopes protection programs); (4) the
tracking-confirmed-delivery rule + "Delivery Fulfillment" definition; (5) AI-agent/scraping
prohibitions. **Avoid:** "for any reason" suspension coupled with indefinite fund freeze and no
process (regulator/PR magnet — prefer Depop-style reasons + timelines); relinquishing customs
returns to the platform without compensation is aggressive.

---

## Poshmark ToS (poshmark.com/terms — Poshmark, Inc., eff. Oct 3, 2024)

**Section outline:** 1. Acceptance · 2. Eligibility & Account (13+ w/ Minors Policy; accurate
info/verification; password; responsibility; no transfers) · 3. Your Privacy (pointer) · 4. Use
of the Service (interactions release; 17-item conduct list; feedback) · 5. Mobile/Third-Party
Software (incl. Apple EULA) · 6. Your Content (responsibility; license; no infringement; content
is public) · 7. Our IP · 8. IP Complaints (DMCA agent) · 9. Third-Party Services & Content
(incl. YouTube API) · 10. Purchases and Sales (risk; sellers; buyers; fees; fee modifications;
prohibited items + Posh Authenticate; purchases; payments; taxes; shipping labels; returns; Posh
Credits; escheatment) · 11. LoL & Warranties · 12. Indemnification (CA §1542 waiver) ·
13. Disputes with Poshmark (JAMS arbitration) · 14. Governing Law & Venue (CA; San Mateo County)
· 15. Disputes with Other Users · 16. Suspending/Terminating/Modifying Access · 17. Changes ·
18. Miscellaneous (a. Trade/Economic Sanctions & Export Controls — text truncated) · 19. Terms
Specific to Your Geographic Location · 20. Notices/Contact.

**Marketplace role:** "Poshmark is not a party to such sale or purchase"; §10(a): not a
participant, "does not take title of any Items," and expressly **"not an auctioneer, consignee,
or a shipping carrier"** — a useful negative-definition list given Poshmark supplies prepaid
labels (as we will).

**Fees:** zero numbers in ToS. Registration free; fees "as set forth in our Fee Policy (which is
incorporated by reference)." Changes: "without notice and at our sole discretion... effective
upon our revision of the Fee Policy." Amounts quoted USD.

**Payments/escrow/protection:** approved methods only; **"Poshmark will receive such payment from
the Buyer on behalf of the Seller"** (agency-for-payment framing); authorization to store payment
info + charge; funds redeemable via third-party payment provider **or spendable on-platform**
(conditioned on sanctions compliance §18(a)). No payout timing in the ToS (lives in
Seller/Shipping policies). May delay/cancel purchases for fraud detection. Returns: "All
purchases are final" except (i) **buyer cancels within 3 hours of purchase**, (ii) Poshmark
cancels/permits, (iii) listing expressly offered returns; details in incorporated Return Policy.
Escheatment clause: user must keep payment info current; dormant funds escheated to the state;
dormancy fee where lawful.

**Authentication:** the model disclaimer set. Posh Authenticate policy incorporated; brands "not
affiliated with Poshmark or the Posh Authenticate service"; team members "not affiliated with or
certified by any brand." §11(a) ALL-CAPS: the program "CANNOT PROVIDE AN ABSOLUTE GUARANTEE OF
THE AUTHENTICITY OF AN ITEM" — it is "a promise that the item has passed the requirements of the
Posh Authenticate process," and **"receiving a refund under the Posh Protect policy is a Buyer's
sole remedy"** for inauthentic/not-as-described items. If Poshmark doubts authenticity it may
cancel the order in its sole discretion; full refund incl. shipping is the buyer's sole remedy;
**seller receives no earnings**; Poshmark may "return, retain, destroy, or otherwise dispose of"
the item; returned items may not be relisted.

**Prohibited items/counterfeits:** Prohibited Items Policy incorporated by reference; counterfeit
posting also listed as conduct violation ("infringe anyone's intellectual property, such as by
posting counterfeit products").

**UGC/IP license:** nonexclusive, worldwide, royalty-free, **transferable**, sublicensable,
perpetual, irrevocable; for operation of the Service "or any other products or services of
Poshmark" + promotion/marketing "in any form, medium or technology now known or later developed,"
incl. republishing to social networks and letting users share listings. No AI/ML-specific
language. "Your Content Is Public" clause + confidentiality waiver. DMCA: designated agent with
street address, phone, copyright@ and ip@ emails; repeat-infringer termination policy; §512(f)
misrepresentation warning. Also: conduct rule limiting use of other users' contact info to the
service + transactions (a seller-side data-protection lite clause).

**Promoted listings:** none in ToS (Posh Credits are promo credits; "Posh Show" livestream terms
are a separate policy in the Legal Center).

**Dispute resolution (the best-drafted of the four):** **JAMS**, Comprehensive or Streamlined
Rules, FAA-governed, delegation to arbitrator incl. arbitrability. **Condition precedent: 60-day
informal resolution** starting from a personally signed Notice of Claim (their agent for service
listed), which must be individual, detailed, and — if requested — followed by a **personal video
conference**. Demand-for-arbitration must contain claimant-specific transaction detail ("not a
superficial or generic statement... applicable to any number of claimants") — anti-mass-arbitration
device. Individual basis only; class waiver in caps; arbitrator limited to individual relief.
**Opt-out: 30 days from first acceptance**, by email (legal@poshmark.com) or certified mail, with
name/address/account/email + clear intent. Small-claims carve-out (either party; buyer's home
county allowed). Severability with public-injunctive-relief saving clause; class claims, if any
survive, go to court and are stayed pending individual arbitrations. Governing law: California;
exclusive venue San Mateo County. 12-month contractual limitation period. Liability cap: greater
of seller fees paid in prior 6 months or **$100**; carve-outs for gross negligence/fraud/willful
misconduct; CA Civil Code §1542 waiver in the indemnity/release.

**INFORM Consumers Act:** not named. §2(b) requires ID documents, proof of address, business info
on request (verification hook); §18(a) sanctions/export heading truncated.

**International:** "Service originates from the United States"; user agrees to comply with US
export laws (§14). Sanctions section §18(a) truncated. No customs-allocation text in ToS
(Shipping Policy handles logistics).

**Suspension/funds:** terminate "at our discretion without explanation, notice, and liability";
may suspend/modify Service incl. "to hold funds, pending any investigations"; ban on circumventing
suspension via new/duplicate accounts (with consequences for facilitators); law-enforcement
referral.

**Worth emulating:** (1) the entire §13 arbitration architecture (JAMS + signed individual notice
+ video conference + specificity requirement + 30-day opt-out + severability) — closest template
for a CA company; (2) modular Legal Center: short ToS + incorporated Fee/Seller/Buyer/Shipping/
Return/Prohibited-Items/Minors policies each changeable independently; (3) "sole remedy" refund
framing on authentication and cancellations; (4) escheatment clause (correct legal treatment of
stale funds — contrast Vestiaire); (5) italic per-section annotations labeled "not complete
summaries." **Avoid:** fee changes "without notice" (pair changes with notice for CA
AB-2098-era optics and EU P2B if ever relevant); "without explanation" termination (fine legally
in US, but Depop shows the friendlier standard); the 3-hour cancel right is buried in §10(g) —
surface it in the buyer policy.

---

## Poshmark Privacy (poshmark.com/privacy) — CAPTURE FAILED

The /privacy capture returned the Terms of Service text again (byte-identical to the /terms
capture) — the Legal Center SPA didn't swap the `<main>` content before text extraction. **No
Poshmark Privacy Policy text is available in these captures; re-capture before relying on it.**

What the capture still establishes:
- **Policy family** (Legal Center nav): Terms of Service · Privacy Policy · **California Privacy
  Notice** (separate CCPA/CPRA doc — a structure worth copying for a CA company) · Minors Policy ·
  Seller Policy · Buyer Policy · Fee Policy · Prohibited Items Policy · Shipping Policy · Return
  Policy · Posh Show Policy · Consignment Network Terms.
- Privacy-adjacent ToS provisions to mirror: §3 is a one-line pointer to the Privacy Policy (keeps
  the ToS clean); §6(d) declares all User Content public/non-confidential with waiver; §4(b)
  restricts users' use of other users' contact info to receiving the service + transactions;
  §2(b) verification-document collection; §9(a) YouTube API terms passthrough; §10(m) payment
  info currency for escheatment.
- Takeaway for our Privacy Policy: ship a standalone California notice (CCPA categories, GPC
  honoring), a Minors section, and disclosures for ID verification vendors (Poshmark's ToS shows
  document verification; Grailed and Vestiaire both name **Persona** — we should name ours).

---

## Depop ToS (July 2026 version; effective 22 Jul 2026, §8.8 from 20 Jul 2026 — Depop Limited, England)

**Section outline:** 1. Welcome (Service; operator; **merchant of record varies**: Depop Limited
UK / Depop Inc. US / Depop Pty Ltd AU) · 2. Your relationship with us (ToS + Help Centre
Policies) · 3. Privacy pointer (+ Requests for Information Policy) · 4. Who can set up an account
(13+; **Business User** concept) · 5. Account security (2FA) · 6. How does Depop work?
(seller fitness/description duty; **6.6 AI-powered listing tools + Repop**; age-restricted items;
swaps; search-ranking disclosure link) · 7. Rules (permitted uses; ~20 prohibitions;
enforcement) · 8. How are items paid for (Depop Payments via **Stripe** or PayPal only; Stripe
Connected Account/Treasury/Services Agreements; **Depop Balance** wallet; direct-debit mandates
Bacs/ACH/BECS; negative-balance debt; Klarna; 8.8 PayPal geo-restriction; 8.9 out-of-app payment
ban; 8.10 180-day withhold) · 9. Shipping and Taxes (labels; customs on buyer; VAT) · 10. Fees
(Selling Fee rest-of-world; **buyer-side Marketplace Fee** UK/US/AU) · 11. Your content (license;
deletion; moderation + **Content Moderation Policy w/ appeals**) · 12. Reporting unauthorised
content (Infringement Report via IP Policy) · 13. You end the relationship · 14. We end it
(45-day no-cause notice; 30-day cure; immediate for risk; statement of reasons) · 15. Liability
(consumer vs Business User tracks; cap = the fee on that transaction) · 16. Business User
indemnity · 17. Resolving Disputes (internal complaints; **CEDR mediation** for EU Business
Users; user-vs-user flow; Depop Protection) · 18. Changes/limitations to Service · 19. Changes
to ToS (advance notice of material changes) · 20. General terms · 21. Law & venue (England;
Australia for AU; consumer carve-outs) · 22. Contact/feedback.

**Marketplace role:** "the agreement for the purchase is made solely between you and the seller"
(and mirror for sales). No title language needed — but adds an affirmative seller duty: "Sellers
are responsible for making sure items are fit for purpose, safe, legally compliant and match the
description." The merchant-of-record-by-region clause (1.3) is unusual and worth noting for a
multi-entity future.

**Fees:** structure in ToS, numbers on help pages ("Details of the fees... are set out here").
Rest-of-world sellers: Selling Fee on final price (excl. tax) + own-arranged shipping. UK/US/AU:
**buyer pays a "Marketplace Fee"** (seller-side selling fee dropped) — itemised on receipts and
order confirmation; **refunded if the order is refunded**; VAT/GST-inclusive statements per
region; sellers get per-transaction fee invoices. "Our shipping rates may change from time to
time."

**Payments/escrow/protection:** Stripe (cards, Apple/Google Pay, Klarna) or PayPal only; listing
requires Stripe onboarding and/or verified PayPal. Incorporates the **Stripe Connected Account
Agreement** by reference — the pattern we need for Stripe Connect. Depop Balance = Stripe
Treasury wallet (US sellers; KYC by Stripe; Stripe can force-out balance to bank). Direct-debit
authorization so Depop can recover negative balances (Bacs UK / bank debit US / BECS AU);
buyer-reimbursement debts recoverable via bank debit or payment link; suspension while negative.
**Out-of-app payments = "serious breach"** → suspension/termination. **On suspension/termination
Depop "may withhold any amounts that have not yet been paid out to you for 180 days** from the
transaction date" (or longer if law/court requires) — the cleanest fund-hold duration clause of
the four. Shipping: seller must dispatch ASAP per shop policies; US late shipment → auto-cancel +
refund; valid tracked-shipping proof required; seller reimburses carrier surcharge overages.
Buyer protection: "Depop Protection" for buyers (UK/US/AU) and sellers (UK/US) via linked
policies; ToS itself only gates eligibility (e.g., ship within stated timelines). Disputes
between users: buyer engages seller first; item-not-arrived raised in-app; not-as-described →
case with Depop; PayPal purchases → PayPal disputes. Depop "has no obligation to resolve any
disputes," decides solely per its Policies, "will not make judgments regarding legal issues,"
and **may resolve on the seller's behalf incl. refunding the buyer and recouping from the
seller's Stripe connected account**.

**Authentication:** none — no legit-check program or authenticity language beyond the
counterfeit/IP prohibitions. (Whitepaper takeaway: authentication language is optional; ours must
be drafted from the Poshmark/Vestiaire patterns, not Depop.)

**Prohibited items/counterfeits:** "List of Prohibited and Restricted Items" incorporated;
IP Policy for infringement; also bans **dropshipping** ("offer to sell an item that you do not
possess... unless you have personally designed it"), off-platform links, **price coordination
with other sellers**, multi-accounts, ratings manipulation, sanctions breaches. Cross-listing on
other marketplaces expressly allowed with conditions (remove promptly when sold elsewhere; own
the double-sale refund).

**UGC/IP license + AI:** license: worldwide, non-exclusive, irrevocable, sub-licensable,
perpetual, royalty-free to "use, display, copy... prepare derivative works, and **exploit** your
User Content... **for the purposes of providing our Service or for any purpose in connection with
the operation of our business, including for marketing purposes**"; moral-rights + publicity
non-assert; legitimate-interest acknowledgment for personal data in content. **No express
AI-training grant** — the July 2026 changes are about AI *tools*, not training: §6.6 lets Depop
offer AI listing-generation and the **Repop** tool (auto-populating another seller's past listing
content into your draft — with a matching carve-out in §7.2's "don't use others' content" rule),
output is "a suggestion only," seller remains responsible for accuracy "regardless of how it was
created." Post-deletion persistence clause (shared/re-shared content, search engines). DMCA-style
process is generalized: "Infringement Report" per the Intellectual Property Policy (UK company —
no §512 agent block). Content Moderation Policy with detection/appeal process; statement of
reasons on removals and terminations (DSA-flavored) with enumerated exceptions.

**Promoted listings:** none in ToS. (Feed ranking disclosure is linked in §6 — a P2B-style
transparency nod.)

**Dispute resolution:** **no arbitration, no class waiver, no jury waiver.** Internal complaint
handling first; **CEDR mediation offered to EU Business Users** (P2B Regulation artifact) with
cost-sharing set by mediator; English governing law (Australian law for AU use) with mandatory
local consumer protections preserved; English courts, but consumers may sue at home. Liability:
consumer track (foreseeability-based, no unlawful exclusions, e.g. death/PI/fraud) vs Business
User track (broad exclusions); **cap = the Selling Fee or Marketplace Fee for the transaction**
(much lower than Poshmark's).

**INFORM Consumers Act:** not present (UK company; US obligations presumably handled
operationally). Sanctions Policy incorporated.

**International:** buyer bears customs/import charges and must **reimburse Depop within 7 days**
if charged to Depop; sellers comply with delivery/customs regulations; VAT calculated/collected
where applicable; PayPal geo-split (§8.8); Sanctions Policy.

**Suspension/termination + funds:** the fairest of the four: (a) no-cause termination on **45
days' notice**; (b) breach termination after **30-day cure**, except repeated breach or "real
risk of loss or harm" → immediate; (c) suspension pending good-faith investigation (incl. related
accounts) with no liability for the hold period; statement of reasons + appeal, with legal
exceptions; 180-day fund withhold (§8.10); back up your own content.

**Worth emulating:** (1) §8's Stripe Connect incorporation stack (Connected Account/Treasury/
Services Agreements) + direct-debit/negative-balance recovery — the exact machinery for our
Stripe setup; (2) 180-day post-termination fund-hold with a stated number; (3) §6.6 AI-tools
clause (outputs are suggestions; user owns accuracy) — reuse for any AI listing helper and even
for automated counterfeit screening ("automated flags are not determinations"); (4) tiered
termination (cure → notice → immediate) + statement of reasons; (5) cross-listing permission with
double-sale liability on the seller. **Avoid** (for us): no arbitration/class waiver (fine for a
UK company, malpractice for a CA C-corp); per-transaction-fee liability cap likely too low to be
conscionable-looking in the US context; some catch-alls ("anything for improper purposes") are
vague.

---

## Vestiaire Buyer T&C (faq.vestiairecollective.com, last update Feb 20, 2025)

**Section outline:** 1. Acceptance (contracting entity by region: SA France / Americas Inc.
Delaware / Singapore Pte; 18+ to transact, not directed to <13; class-action waiver notice) ·
2. Changes (effective immediately on posting) · 3. Role and responsibility of VC · 4. Placing
the Order (professional vs non-professional seller labeling; price includes commission; sale
contract **subject to conditions precedent**) · 5. "Make an Offer" (floor: 70% of price) ·
6. Authentication & QC Reports (6.1 costs; 6.2 Report disclaimers) · 7. Delivery (7.1 via VC or
direct-by-seller; 7.2 up to 30 days; "ready to go" ships in 3 business days; 7.3 shipping +
customs prepaid at checkout) · 8. Impossibility to deliver (1-month hold → relist → **VC owns
after 6 months**) · 9. Title & risk (title passes on full payment; risk on receipt) ·
10. Receipt/checking (carrier reservations; **72h non-conformity window; 48h non-receipt
window**; no window for counterfeits) · 11. Payment (card via **Adyen** (named data controller)
or PayPal; FIA-NET fraud checks; currencies + **up to 5% conversion fee**; vouchers; **11.3 Buyer
Service Fee ≤30%, min 5 EUR/GBP/USD/CHF**; 11.4 rounding credited to fee) · 12. Statutory
warranties (French Consumer Code conformity, 2 yrs, professional sellers; hidden defects) ·
13. Claims and returns (13.1 non-receipt/late → cancel + 14-day refund; 13.2 non-conformity
caught in VC exam → cancel or 72h buyer election; 13.3 non-conformity found on receipt,
split by seller type and shipping route) · 14. Right to withdraw (professional-seller purchases
only) · 15. Returns mechanics (seal intact; damaged-return offsets; $25 recovery fee;
6-month abandonment → VC ownership) · 16. Duration/validity · 17. Interruption/rescission
(suspension) · 18. Questions · 19. Mediation (FEVAD; EU ODR) · [misnumbered] "10." Applicable law
(French law; French courts; class-action waiver) + withdrawal form PDF.

**Marketplace role:** "limited to acting as an intermediation platform between the Users"; "shall
not act as a reseller... shall not become the owner of the Products"; not a party to the sale.
Sharpest add-on: examination "shall merely relate to whether the Seller's Product is in keeping
with the description" — VC "does not guarantee that the Buyer shall find the Product
satisfactory" aesthetically or practically; deliveries by VC's subcontractors don't make it a
party. Complaints about products route to the seller.

**Fees:** the only doc that hardcodes numbers — as **ceilings**: Buyer Service Fee "may not
exceed 30% of the price," minimum 5 (EUR/GBP/USD/CHF), tax-inclusive, baked into the displayed
price; authentication/examination costs disclosed pre-order (waived for direct shipping); ≤5%
currency-conversion fee with an avoid-it-by-switching-currency path; rounding pennies allocated
to the fee (unusually candid).

**Payments/escrow/protection:** buyer pays VC; **the sale is a contract subject to conditions
precedent — VC's receipt of the item from the seller AND a positive examination** — so failed
authentication legally unwinds the sale (elegant escrow justification; for direct-by-seller
shipping the contract forms at order). Claims: non-receipt → cancel after cure period, refund in
14 days; postal litigation can extend delivery period and **hold the refund**. Non-conformity
found in VC's exam: counterfeit/prohibited → auto-cancel + refund; partial conformity → buyer has
72h to accept or cancel (discount can be store credit/voucher/card refund). Found on receipt:
72-hour window, photos required, VC authorizes the return; VC re-inspects — if actually
compliant, item is **relisted under the buyer's account** (or returned at buyer's expense);
returns must carry VC's original **seal/label intact**. Buyer's "final sale" baseline for
private-seller purchases is softened by a no-commission **relisting** option (with resale
cost table $17–$55 by price band).

**Authentication ("Legit Check") disclaimers — the gold standard for our feature:** Reports on
physically inspected products are (i) performed **independently** of brands, (ii) not based on
brand data/assistance, (iii) brands "are not responsible for" and "may not honour" VC's
conclusions, (iv) **"do not constitute a certificate of authenticity, proof of authenticity or
similar"** and cannot be presented to third parties as such, (v) information-purposes-only, no
third-party reliance, liability disclaimed for use off-platform. Port all five prongs into our
Legit Check thread + automated screening language.

**Prohibited items/counterfeits (buyer view):** counterfeit receipt → no claim window, contact
ASAP; counterfeit found at exam → cancel + refund. Prohibited categories (prototypes, uniforms,
press-sale items) are detailed on the seller side.

**UGC/IP license & DMCA:** none — lives in the separate Website Terms of Use (listed as a related
article). Split-document architecture: Buyer T&C + Seller T&C + Terms of Use + Privacy govern
together.

**Promoted listings:** none.

**Dispute resolution:** **no arbitration.** FEVAD e-commerce mediation + EU ODR platform;
**French law and French courts** — even though US residents contract with Vestiaire Collective
Americas Inc. (Delaware); ALL-CAPS class-action/representative-action/class-arbitration waiver
"IN ALL JURISDICTIONS INCLUDING YOUR HOME JURISDICTION." (A bare class waiver without an
arbitration agreement is of doubtful enforceability in the US — don't copy.) CISG excluded.

**INFORM Consumers Act:** not present.

**International:** the most complete customs story: duties **prepaid at checkout** ("the Buyer
shall not have to pay any further customs duties upon receipt"); tri-entity contracting by
region; currency conversion regime; listings shown in seller's original language, original
prevails over translations (VC disclaims translation liability).

**Withdrawal rights / trader-vs-private distinction:** product pages must state whether the
seller is Professional or non-Professional. **US buyers from Professional Sellers: 7-day
cooling-off** post-receipt, no reason needed; refund of price + outbound shipping within 30 days;
buyer pays return costs; exclusions for removed hygiene seals and worn/used-outdoors new
products; counterfeit statutory rights preserved. **No withdrawal right for private-seller
purchases** — replaced by the commission-free relist gesture. (The EU 14-day statutory
withdrawal appears in the Seller T&C §9.3; this en-US buyer doc localizes to 7 days.) French
statutory warranties (conformity: 2 years, defect presumption 6 months for second-hand;
hidden defects) run **against the seller**, professional sellers only.

**Suspension/funds:** breach → temporary interruption; if curable and not cured **within 2
calendar days** of notice → permanent bar (with email notice of the impending measure); immediate
termination for serious violations (multiple accounts, fraudulent payment methods, attempted
fraud, other criminal offences); banned users keep limited access **until ongoing transactions
complete**; fraud-review payout blocks — fraudulent account → all pending payouts cancelled;
cleared → payout regenerated.

**Worth emulating:** (1) conditions-precedent sale structure tying contract formation to
authentication pass; (2) the five-prong Report disclaimer; (3) precise claim windows (72h
not-as-described / 48h non-receipt / no window for counterfeits); (4) tamper-seal return
requirement; (5) duties-prepaid-at-checkout promise; (6) letting banned users complete in-flight
transactions. **Avoid:** "effective immediately... without notice" T&C changes; French law/venue
imposed on US consumers (map governing law to the contracting entity); class waiver without
arbitration; the 2-day cure window is unrealistically short.

---

## Vestiaire Seller T&C (last update Mar 9, 2026; captured through §11.1)

**Section outline (captured):** Presentation (tri-entity; 18+; class-waiver notice; consignment
terms may layer on) · 1. Role and responsibility of VC · 2. Sale of Products (2.1 **Mandate**;
2.2 product-page creation/modification; min price $16; crossed-out prices; VC price suggestions
require seller acceptance) · 3. Make an Offer (70% floor) · 4. Option for VC to acquire the
Product directly · 5. Conformity check (non-compliant → renegotiate or cancel; **€/£/$15
handling fee** to reclaim item) · 6. Impossibility to deliver (1-month hold → relist → VC owns at
6 months; €15 retrieval) · 7. Seller's commitments (sole owner; accurate description; proof of
ownership on demand; no prototypes/uniforms/press-sale items; holiday mode) · 8. **Seller Fees**
(a. structure + **30% cap**; b. category-specific; c. deduction; d. modifications; e.
applicability at time of sale; f. Help Centre schedule incorporated by reference; g. professional
sellers may have different caps by separate agreement) · 9. Sales & payments (9.1 fraud checks;
9.2 shipping paths + prepaid vouchers + 7-day ship / 15-day receipt windows + cleanliness;
9.3 payment to seller + set-off + Hyperwallet + **Persona ID verification** + currencies +
vouchers; 9.4 **1099-K**; 9.5 payment time periods + pending-payment forfeiture; 9.6 counterfeit
regime) · 10. Title & risk · 11. Claims and returns (11.1 non-receipt/late captured) ·
[TRUNCATED — remainder of 11, and presumably 12+ (suspension §13 is cross-referenced), misc,
governing law]

**Marketplace role:** mirror of buyer doc ("limited to acting as an intermediation platform...
shall not act as a reseller and shall not become the owner"), with the exception carved out for
products VC sells on its own behalf (flagged on-site). §2.1 adds a civil-law **mandate**: seller
authorizes VC to publish the listing (and edit photo backgrounds), **accept the buyer's order
"for and on behalf of the Seller,"** open a ledger account for the seller, receive the money and
transfer it minus fees — a clean legal basis for platform-held escrow without becoming a party.

**Fees:** most sophisticated fee clause of the four: Seller Fees defined to include *all*
components (selling/processing/service/etc.), **hard cap of 30% of price**, rates variable by
category/subcategory/brand/price band; Help Centre schedule **"incorporated by reference...
forms part of the contractual agreement"**; changes effective immediately on publication and
apply to already-listed unsold items — **the fee at time of sale (not listing) governs**; fee
changes void pending offers; professional sellers can contract out of the cap.

**Payments/escrow/payout:** payout = buyer's money minus fees, inspection costs, carriage, and
other sums due, **paid after VC confirms the product matches the listing** — or, for direct
shipping, **within 3 days of the buyer's confirmation of receipt** (another 3-day comp for our
escrow). ~5 business days bank latency disclaimed. Post-payout clawback duties: counterfeit or
professional-seller withdrawal (statutory **14 days**) → seller reimburses on demand. Buyer
claim → VC may withhold payout until resolved. Fraud monitoring → temporary payout blocks;
fraudulent/breaching account → pending payouts "cancelled permanently"; **seller waives interest
on held amounts**. Payments pending >12 months (KYC incomplete) may be cancelled, held 5 years
while VC attempts contact, then **forfeited to VC** "subject to applicable law." Payout rails:
PayPal **Hyperwallet** (KYC terms incorporated); **Persona** for identity verification;
sub-threshold payouts become site vouchers. **Set-off clause**: offset any seller debt (buyer
refunds, chargebacks + processor fees, counterfeit inspection fees, shipping/cleaning/repair/
storage, penalties, investigation/legal costs) against payouts, retain possession of products,
apply new-transaction proceeds to old debts; email notice with debt detail; account functions
limited until resolved. 1099-K: VC self-identifies as a **TPSO**, IRS thresholds, forms by Jan
31, gross amounts pre-fee; **no tax info → payments suspended and account blocked**.

**Authentication/QC:** framed as conformity checking ("merely designed to ensure that a Product
sold by a Seller is in keeping with its description") — the guarantee-avoidance mirror of the
buyer doc's Report disclaimers. Physical exam = "best efforts to prevent the sale of counterfeit
products," not a warranty.

**Prohibited items + counterfeit structure (most elaborate of the four):** seller warrants sole
ownership, accurate description, and non-counterfeit; must produce proof of ownership/origin on
demand or face listing/profile deletion without compensation. Banned: prototypes, brand-employee
uniforms, employee/press-sale items. VC is a signatory of France's anti-counterfeiting charter
and the EU MoU on the sale of counterfeits. Counterfeit found: immediate withdrawal; account
suspension; sale cancelled; seller refunds VC and **indemnifies VC for all costs**; item risk of
brand/authority seizure sits on seller; unclaimed counterfeit destroyed after 6 months unless
seller pays €/£/$15 and proves authenticity "to Vestiaire Collective's satisfaction."
**Fraudulent-seller override:** flagged/systematic counterfeiters lose the reclaim option
entirely — items retained/destroyed/handed to brands or authorities, **all pending and future
payments related to counterfeit sales forfeited**, account permanently terminated; applies when
VC determines, in its sole discretion, activity is "intentional, systematic, or repeated."

**UGC/IP/DMCA:** only the §2.1 mandate license (publish listing, edit photo backgrounds, display
photos/description on partner sites free of charge, incl. for advertising). Fuller IP terms live
in the separate Website Terms of Use (not captured).

**Promoted listings:** none captured ("sponsored countries" in §8(c) refers to shipping-subsidized
countries, not ads).

**Dispute resolution / governing law:** class-waiver notice in the preamble; governing-law
section not captured (buyer doc says French law/courts; seller doc presumably matches). No
arbitration visible.

**INFORM Consumers Act:** not named; the 1099-K + Persona KYC + proof-of-ownership provisions are
the functional overlap.

**International / trader-vs-private:** tri-entity contracting; prepaid international shipping
vouchers for listed countries only (others self-fund + insure to VC's checking unit); DOM-TOM
carve-outs; **Professional Sellers**: separate fee agreements (§8(g)), EU-style 14-day buyer
withdrawal exposure (§9.3), and (per the buyer doc) obligations under statutory conformity
warranties. The doc assumes the trader/consumer split throughout rather than defining thresholds
in-text.

**Suspension/funds:** see payout holds/set-off above; §13 (account restrictions) referenced but
in the truncated tail.

**Worth emulating:** (1) the fee-cap-plus-flexible-schedule design (defensible "fees may change"
clause because the ceiling is contractual); (2) time-of-sale fee rule + voiding pending offers on
fee changes; (3) the mandate/limited-agency clause authorizing us to accept orders and hold funds
for sellers (maps neatly onto Stripe Connect separate-account flows); (4) counterfeit disposition
ladder (withdraw → suspend → refund/indemnify → 6-month reclaim window w/ fee → destroy) with the
fraudulent-seller forfeiture override; (5) explicit set-off clause with notice mechanics.
**Avoid:** the 5-year-then-forfeit-to-us treatment of unclaimed seller funds — for a CA company
that money must **escheat to the state** (follow Poshmark's escheatment clause instead); seller
waiving interest on held funds is fine, forfeiture is not; fee changes hitting already-listed
items "immediately upon publication" without notice would irritate US regulators and EU P2B.

---

## Cross-platform synthesis

**Common skeleton all four share** (order varies, presence is near-universal):
1. Acceptance/binding contract + incorporation-by-reference of a policy suite
2. Eligibility/age + account (accuracy, security, no transfer, ID verification hook)
3. Privacy pointer (one line; the policy lives elsewhere)
4. **Marketplace-role disclaimer** — venue/intermediary; sale contract is buyer↔seller; platform
   is "not a party," takes **no title**; users bear transaction risk
5. Seller terms (listing accuracy, lawful-to-sell, ship windows) / Buyer terms (read the
   listing, binding purchase, pay taxes/shipping)
6. Fees — **all four keep numbers OUT of the ToS** and point to a fee page/policy incorporated
   by reference (Vestiaire uniquely adds an in-ToS 30% ceiling; Grailed/Poshmark reserve
   unilateral change; Depop/Vestiaire split fees buyer-side vs seller-side)
7. Payments through named third-party processors, with consent to processor terms
8. Shipping (platform labels discontinuable at will; auto-cancel unshipped orders) + customs on
   the buyer + taxes (marketplace-facilitator collection + user's own reporting duty)
9. Returns/protection: "all sales final" baseline + a platform protection program whose refund is
   the **sole remedy**, gated by short claim windows and tracking-confirmed delivery
10. Prohibited items + counterfeit ban (list in a separate policy; platform may cancel, keep or
    destroy the item, deny seller earnings)
11. UGC license (worldwide, royalty-free, sublicensable, perpetual/irrevocable, marketing
    included) + platform IP + IP-complaint/DMCA process
12. Disclaimers ("AS IS") + liability caps + indemnity
13. Dispute resolution (US: arbitration; EU/UK: mediation/courts) + governing law
14. Suspension/termination + fund holds + circumvention ban
15. Changes-to-terms + misc (severability, no waiver, no agency, export/sanctions, notices)

**Where they differ (drafting axes):**
- **US vs EU DNA.** Grailed/Poshmark: individual arbitration (Poshmark: JAMS) + class waiver +
  30-day opt-out + small-claims carve-out + $100-ish caps + "any reason, no notice" termination.
  Depop/Vestiaire: no arbitration; mediation bodies (CEDR / FEVAD + EU ODR); notice-and-cure
  termination, statements of reasons, statutory-warranty acknowledgments, P2B/DSA artifacts.
  As a CA C-corp we take the US spine and can cherry-pick EU fairness features (Depop's 45-day/
  30-day-cure ladder, statement of reasons) as brand differentiators.
- **Escrow/payout timing:** Grailed = credit ≤3 days after tracked delivery (with enumerated hold
  carve-outs); Vestiaire = pay after authentication pass, or ≤3 days after buyer-confirmed
  receipt for direct shipping; Poshmark/Depop push timing into policies. Our ~3-day release has
  two direct precedents — always pair it with (i) hold carve-outs and (ii) a fund-hold duration
  on termination (Depop's 180 days).
- **Authentication posture:** Poshmark (process-pass promise, refund sole remedy) and Vestiaire
  (independent opinion, "not a certificate," brands may not honour) disclaim hard; Grailed's
  capture has only generic no-guarantee language; Depop has none. Nobody guarantees authenticity.
- **Fee-change mechanics:** "without notice" (Poshmark) → "upon notice" (Grailed) → "immediately
  on publication but capped at 30% + time-of-sale rule" (Vestiaire) → buyer-fee itemization +
  refund symmetry (Depop).
- **AI:** Grailed bans AI scraping/training-adjacent extraction and AI purchasing agents; Depop
  regulates AI *listing tools* (Repop; outputs are suggestions); **no platform yet takes an
  express "train our models on your content" license** — all rely on broad "operate our
  business"/"automated scanning" language. For our ML personalization + automated counterfeit
  screening, an express-but-scoped grant (train/improve search, recommendations, and integrity
  models) would be more defensible than the ambiguity — and pair it with a Grailed-style
  anti-scraping/AI-agent clause pointed outward.
- **INFORM Consumers Act: none of the four names it** in these captures — verification appears as
  Persona/KYC/1099-K plumbing. A new US marketplace should say it expressly (high-volume seller
  info collection, verification cadence, disclosure of seller identity, suspension for
  non-compliance, reporting hotline) rather than burying it.
- **Promoted listings: absent from every captured ToS.** Paid boosts evidently live in separate
  incorporated policies. Ours should exist at launch: fees non-refundable, no guarantee of
  placement/performance, "Ad/Sponsored" labeling, our right to pause campaigns, interaction with
  refunds/removals.

**Clauses a new competitor must not omit (the 10):**
1. **Venue/no-title/no-party clause** with Poshmark's negative list adapted ("not an auctioneer,
   consignee, or shipping carrier") + Grailed-style inherent-risk and off-site-activity clauses.
2. **Fee schedule incorporated by reference** + change mechanics with notice (consider a
   Vestiaire-style contractual cap and time-of-sale rule); buyer-facing fee itemization.
3. **Stripe Connect stack**: consent to processor + incorporation of the Stripe Connected Account
   Agreement, payout conditions, negative-balance/auto-debit recovery, set-off, chargeback debt.
4. **Escrow/payout clause**: release ~3 days after tracked delivery, with enumerated hold rights
   (open claim, fraud review, legal requirement) + 180-day style hold on termination +
   **state escheatment (never forfeiture) for unclaimed funds**.
5. **Buyer-protection program**: short claim window (Grailed 3 days / Vestiaire 72h), no-INR-if-
   tracking-shows-delivered rule, refund-as-sole-remedy, counterfeit carve-out from windows,
   item disposition rights (return/retain/destroy; no relisting by seller).
6. **Authenticity disclaimer** covering BOTH moderator Legit Check threads and automated
   screening: independent opinions, not a certificate or guarantee, brands unaffiliated and may
   not honour, no third-party reliance, refund sole remedy; automated flags are signals, not
   determinations (Depop §6.6 pattern).
7. **Counterfeit/prohibited-items regime**: seller reps (title, authenticity, accuracy) +
   incorporated prohibited list + Vestiaire's disposition ladder + fraudulent-seller override +
   seller indemnity for brand/authority claims.
8. **UGC license + IP process**: perpetual, sublicensable, marketing-inclusive license with an
   express ML/personalization scope; DMCA designated agent + repeat-infringer policy + §512(f)
   warning; anti-scraping/AI-agent prohibitions.
9. **Poshmark-grade arbitration clause**: JAMS (or AAA), FAA, 60-day informal-resolution
   condition precedent with signed individual notice + conference, individualized-demand
   requirement (mass-arbitration hygiene), class + jury waiver, 30-day opt-out, small-claims
   carve-out, public-injunctive-relief severability, CA law + venue, liability caps + 12-month
   limitation, CA §1542 waiver.
10. **Termination + compliance tail**: suspension/termination grounds with a Depop-style
    notice/cure ladder and fund-hold terms; circumvention ban; export/sanctions (SDN/embargo)
    clause; customs-duties allocation to buyer + seller customs-info accuracy; express INFORM
    Consumers Act section; marketplace-facilitator tax + 1099-K/TPSO disclosure.
