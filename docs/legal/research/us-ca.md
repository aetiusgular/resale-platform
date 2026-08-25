# US / California Legal Research — ToS & Privacy Policy for C2C Resale Marketplace
**Prepared:** 2026-08-25 · **Entity:** California C-corp · **Platform:** C2C secondhand luxury/streetwear marketplace (18+, Stripe Connect separate charges & transfers with ~3-day post-delivery escrow, one-time paid "boosts" (no subscriptions), Stripe Identity verification at $5,000 cumulative sales, PostHog analytics, Sentry error tracking, Vercel + Supabase hosting, ML recommendations + automated counterfeit screening with human review of negative outcomes).

**Research note:** `leginfo.legislature.ca.gov` blocks automated fetching (robots.txt), so California statute text was verified via Justia mirrors and, for § 1789.3, a secondary source cross-checked against DCA-published contact details. Everything time-sensitive was verified current as of August 2026 unless flagged.

---

## 1. CCPA/CPRA — California Consumer Privacy Act (as amended by CPRA)

- Applies to for-profit businesses doing business in California that meet **any one** of: (a) **gross annual revenue over $25 million**; (b) **buy, sell, or share personal information of 100,000+ California residents or households** per year; (c) **derive 50%+ of annual revenue from selling/sharing** California residents' PI. An early-stage marketplace may be below thresholds at launch, but a growing consumer marketplace will cross the 100,000-consumer threshold quickly — draft the Privacy Policy CCPA-compliant from day one.
- **Consumer rights to disclose and operationalize:** right to know/access (categories + specific pieces, sources, purposes, third parties), right to delete (with exceptions), right to correct, right to opt out of sale/sharing, right to limit use/disclosure of sensitive PI, right to non-discrimination for exercising rights.
- **Notice at collection:** at or before collection, list categories of PI collected (incl. sensitive PI), purposes, whether sold/shared, retention periods, and link to the full privacy policy.
- **"Do Not Sell or Share My Personal Information" link** required if the business sells/shares PI. Cross-context behavioral advertising counts as "sharing" (no money needed). PostHog used purely as a service provider under a DPA is not a sale/share, but any ad-tech pixels/retargeting would be — the policy must take a position either way.
- **Global Privacy Control:** businesses that sell/share **must honor GPC/opt-out preference signals** as a valid opt-out request; the AG has enforced this (Sephora settlement). Disclose GPC handling in the policy.
- Sensitive PI on this platform includes government ID data flowing through Stripe Identity and account credentials; if only used to provide the service / verify identity (permitted purposes), the "Limit" right may not be triggered, but the policy should still disclose categories and purposes.
- Privacy policy must be updated at least every 12 months; disclose the 12-month look-back categories collected/disclosed/sold/shared, and describe two or more request methods (incl. a toll-free number once thresholds are comfortably met, or webform+email for online-only businesses).

**Citation:** Cal. Civ. Code §§ 1798.100–1798.199.100 (CCPA as amended by Prop 24/CPRA); CCPA Regulations, Cal. Code Regs. tit. 11, § 7000 et seq.
**Drives:** Privacy Policy — entire "California Privacy Rights" section, notice at collection, categories tables, GPC statement, "Do Not Sell or Share" link decision, request methods & verification, retention disclosures.
**Source:** https://oag.ca.gov/privacy/ccpa

---

## 2. CPPA Regulations — ADMT, Risk Assessments, Cybersecurity Audits (2025 package)

- **Status: FINAL.** Adopted by CPPA Board July 24, 2025; approved by the Office of Administrative Law and filed with the Secretary of State in late September 2025 (CPPA states Sept 22, 2025); **effective January 1, 2026**. This is settled law as of August 2026.
- **ADMT (Art. 11):** obligations (pre-use notice, opt-out, access/appeal rights) apply only where technology **"replaces or substantially replaces human decision-making"** to make a **"significant decision"** — provision/denial of financial or lending services, housing, education enrollment/opportunities, employment or **independent contracting opportunities or compensation**, or healthcare services. **Behavioral advertising and content personalization were dropped from the final ADMT scope** — the platform's ML recommendation feed does NOT trigger ADMT duties.
  - **Compliance deadline: January 1, 2027** for ADMT uses already occurring; immediate compliance for new uses after that date.
  - **Counterfeit-screening caution:** automated seller suspensions/listing bans could be argued to affect "independent contracting opportunities or compensation" for sellers. The platform's design (human review of negative outcomes) supports the human-involvement carve-out — but the reviewer must be able to interpret the output, consider other information, and have authority to change the decision. Keep that review meaningful and documented; disclose "automated screening with human review" in ToS/PP.
- **Risk assessments (Art. 10):** required before processing that presents significant risk, including **selling/sharing PI (incl. for cross-context behavioral advertising)**, **processing sensitive PI**, using ADMT for significant decisions, certain profiling (work/school; sensitive locations), and **training ADMT for significant decisions or training facial-recognition/identity-verification technology**. Stripe Identity is a third-party processor (platform is not training the model), but processing ID documents = sensitive PI → likely triggers a risk assessment once the business is CCPA-covered. Initial assessments for pre-existing activities due by **December 31, 2027** (per Skadden summary); attestation/submission to CPPA for 2026–2027 assessments due **April 1, 2028**, then April 1 annually.
- **Cybersecurity audits (Art. 9):** annual independent audits phase in by revenue — **>$100M (2026 revenue): first audit by April 1, 2028; $50–100M: April 1, 2029; <$50M (if audit-threshold met): April 1, 2030.** Not immediate for a startup, but roadmap it.

**Citation:** Cal. Code Regs. tit. 11, §§ 7120–7124 (cybersecurity audits), 7150–7157 (risk assessments), 7200–7221 (ADMT), effective Jan. 1, 2026.
**Drives:** Privacy Policy — automated-processing/profiling disclosure, ADMT pre-use notice (only if counterfeit screening is treated as covered); ToS — statement that enforcement decisions get human review + appeal channel; internal compliance calendar (not a policy clause): risk assessments 2026–27, audit phase-in.
**Source:** https://cppa.ca.gov/regulations/ccpa_updates.html ; https://www.skadden.com/insights/publications/2025/10/california-finalizes-cppa-regulations ; https://www.whitecase.com/insight-alert/cppa-finalizes-rules-admt-risk-assessments-and-cybersecurity-audits-requirements

---

## 3. CalOPPA — Cal. Bus. & Prof. Code §§ 22575–22579

- Applies to **any** operator of a commercial website/online service that collects PII about California residents — **no revenue or volume threshold**. This binds the platform from day one regardless of CCPA applicability.
- Must **conspicuously post** the privacy policy (distinctive link containing the word "Privacy"); 30-day cure period after notice of noncompliance before violation attaches.
- The policy **must** contain: **(b)(1)** categories of PII collected AND categories of third parties with whom it may be shared; **(b)(2)** description of any process for users to review/request changes to their PII; **(b)(3)** the process for notifying users of **material changes** to the policy; **(b)(4)** the policy's **effective date**; **(b)(5)** **how the operator responds to browser "Do Not Track" signals** or other choice mechanisms regarding cross-site/over-time tracking; **(b)(6)** **whether third parties may collect PII about users' online activities over time and across different sites** (PostHog/Sentry SDKs and any embedded third-party scripts make this disclosure necessary); (b)(7) the DNT disclosure may be satisfied via a clear and conspicuous hyperlink to a tracking-choices description.
- Practical drafting: include an explicit "Do Not Track" paragraph (most sites state they do not respond to DNT but honor GPC — reconcile with CCPA GPC duty in §1).

**Citation:** Cal. Bus. & Prof. Code §§ 22575–22579.
**Drives:** Privacy Policy — effective date line, categories/third-parties tables, change-notification clause, DNT/GPC disclosure, third-party tracking disclosure, conspicuous footer link.
**Source:** https://law.justia.com/codes/california/code-bpc/division-8/chapter-22/section-22575/ (leginfo.legislature.ca.gov blocked automated fetch)

---

## 4. "Shine the Light" — Cal. Civ. Code § 1798.83

- Applies to businesses with **20+ employees** that have an established business relationship with California customers and disclosed PI to third parties **for those third parties' direct marketing purposes** in the preceding calendar year.
- If applicable: on request, **once per calendar year, free of charge**, disclose the categories of PI shared for third-party direct marketing and the **names and addresses of those third parties**; respond within **30 days** via designated channels (up to 150 days otherwise).
- **Alternative compliance (§ 1798.83(c)(2)) — the standard approach:** adopt and disclose a policy of **not** sharing PI with third parties for their direct marketing unless the user opts in (or of honoring opt-outs), and describe how to exercise that choice. Must designate a contact point (email/mailing address/toll-free number) and prominently label the section (customarily "Your California Privacy Rights").
- Small-company note: below 20 employees the statute doesn't apply, but the clause is customarily included from the start; the platform's model (no third-party direct-marketing sharing) fits the (c)(2) alternative cleanly.

**Citation:** Cal. Civ. Code § 1798.83.
**Drives:** Privacy Policy — "Your California Privacy Rights (Shine the Light)" section stating the no-third-party-direct-marketing policy + request contact.
**Source:** https://law.justia.com/codes/california/code-civ/division-3/part-4/title-1-81/section-1798-83/

---

## 5. California Consumer Notice — Cal. Civ. Code § 1789.3

- Applies to providers of consumer services through electronic means to California consumers (targets paid services — seller commissions and paid boosts bring the platform within its intended scope). Enforcement is rare (civil penalties up to $5,000 for knowing/willful violations, public enforcers only), but inclusion is near-universal California practice.
- Required disclosures to California users: (1) provider's **name and physical address**; (2) a statement of **charges/fees** for the service; (3) how to file a complaint, including the Department of Consumer Affairs contact.
- **Standard notice contact (verify at print time):** Complaint Assistance Unit, Division of Consumer Services, California Department of Consumer Affairs, **1625 North Market Blvd., Suite N 112, Sacramento, CA 95834; telephone (800) 952-5210**. (The commonly quoted second line, (916) 445-1254, appears in DCA materials and countless ToS; the (800) number and address above were confirmed via secondary sources against DCA's published address. Direct statute text was not fetchable — leginfo robots block. Flag for counsel to confirm the (916) number before publishing.)

**Citation:** Cal. Civ. Code § 1789.3.
**Drives:** ToS — "Notice to California Users" clause with company identity/address, fee statement cross-reference, and the DCA Complaint Assistance Unit contact block.
**Source:** https://legalclarity.org/california-civil-code-section-1789-3-requirements/ (statute mirror 404'd; secondary source used — flagged)

---

## 6. California Minors "Eraser Button" — Cal. Bus. & Prof. Code §§ 22580–22582

- § 22581 applies to operators of sites/apps **directed to minors** OR with **actual knowledge that a user under 18 is using the service**. An 18+ ToS does not immunize the platform: if it gains actual knowledge of a minor registrant (e.g., support ticket, ID verification mismatch), the statute applies to that user.
- Registered minor users must be allowed to **remove (or request removal of) content/information they themselves posted**, with **notice of the right and clear instructions**, plus a disclaimer that removal "does not ensure complete or comprehensive removal."
- Exceptions: content posted/reposted by third parties, anonymized content, content the law requires be retained, content the minor was compensated for; compliance = rendering content **no longer visible to other users** (server deletion not required).
- § 22580 separately bars knowingly marketing specified products (alcohol, tobacco, etc.) to known minors — moot for an 18+ platform but supports the eligibility clause.
- Practical drafting: keep the 18+ eligibility clause, add that accounts of under-18 users will be terminated on discovery and that any minor who nonetheless used the service may request removal of posted content via support (belt-and-suspenders compliance).

**Citation:** Cal. Bus. & Prof. Code §§ 22580–22582 (Privacy Rights for California Minors in the Digital World).
**Drives:** ToS — eligibility (18+) clause + minors termination/removal sentence; Privacy Policy — children/minors section.
**Source:** https://law.justia.com/codes/california/code-bpc/division-8/chapter-22-1/section-22581/

---

## 7. INFORM Consumers Act — 15 U.S.C. § 45f (FTC-enforced)

- **High-volume third party seller:** in any continuous 12-month period during the previous 24 months, **200+ discrete sales/transactions of NEW or UNUSED consumer products AND $5,000+ aggregate gross revenues** through THAT marketplace. Applies only to new/unused consumer products (Magnuson-Moss definition) — but a "secondhand" luxury/streetwear marketplace absolutely hosts new/unused goods (deadstock, BNWT), so the Act cannot be ignored; the platform must track the new/unused flag per listing to identify covered sellers.
- **Collect within 10 days** of a seller qualifying: bank account number (or payee name), government-issued ID (individuals) or government/tax records (businesses), business tax ID or TIN, current working email and phone. **Verify within 10 days** of collection (methods that reliably confirm validity, correspondence to the seller, not misappropriated/falsified; tax documents get a presumption of verification).
- **Annual certification:** at least annually notify covered sellers and require **electronic certification** that their information is current; changes must be certified within 10 days.
- **Suspension duty:** if a covered seller fails to provide/certify within 10 days of written notice, the marketplace **must suspend** future sales until compliance.
- **Buyer disclosure ($20,000+ annual gross revenues sellers):** conspicuously disclose in the listing or order confirmation the seller's **full name, physical address, and contact information** (phone/email/electronic messaging); limited partial-disclosure exceptions for residential addresses / no business phone (then country + state + electronic contact), revocable if the seller made false representations or ignores consumer inquiries.
- **Reporting mechanism:** each covered seller's listing page must **clearly and conspicuously offer both a phone number and an electronic means** for consumers to report suspicious marketplace activity.
- **Data security & use limits:** reasonable security for collected seller data; use only for INFORM compliance unless otherwise legally required.
- **Enforcement:** FTC (unfair/deceptive practice; civil penalty **$53,088 per violation** as of the Jan. 2025 inflation adjustment — adjusted annually, so slightly higher in 2026) and **state attorneys general**.
- **Platform-policy alignment:** the $5,000-cumulative Stripe Identity trigger is more conservative on dollars but is NOT the statutory test — compliance logic must monitor the **200-transactions-AND-$5,000 (new/unused goods, rolling 12-in-24 months)** trigger, plus the separate $20,000 disclosure tier.

**Citation:** 15 U.S.C. § 45f (INFORM Consumers Act, effective June 27, 2023).
**Drives:** ToS — seller obligations (information/verification/certification duties, suspension right AND duty), buyer-facing seller-identity disclosure clause, "report suspicious activity" mechanism; Privacy Policy — categories collected for INFORM compliance and legal-obligation purpose.
**Source:** https://www.law.cornell.edu/uscode/text/15/45f ; https://www.ftc.gov/business-guidance/resources/informing-businesses-about-inform-consumers-act

---

## 8. IRS Form 1099-K — Threshold for Tax Year 2026 (CONFIRMED CURRENT)

- **The $20,000 / 200-transaction standard is back.** The One, Big, Beautiful Bill (OBBBA, July 2025) **retroactively reinstated the pre-ARPA threshold "as if the ARPA change had never been enacted."** IRS FAQs (Oct. 23, 2025) confirm: TPSOs file Form 1099-K only when gross reportable payments to a payee **exceed $20,000 AND** the number of transactions **exceeds 200** — an AND test. This governs calendar year 2025 (forms filed early 2026) **and calendar year 2026**. The phased $5,000 (2024) / $2,500 (2025) / $600 schedule is dead.
- The platform (via its payment structure) sits in TPSO/marketplace territory — coordinate with Stripe on who files (with Stripe Connect separate charges & transfers, Stripe is generally the settlement entity that files 1099-Ks for connected accounts, but the ToS should not promise thresholds — say forms are issued "where required by law").
- Voluntary filing below threshold is permitted; sellers owe tax on income regardless of receiving a form. Backup withholding applies if a payee fails to furnish a valid TIN — supports requiring taxpayer info in seller onboarding.
- **Flag:** several states impose lower state 1099-K thresholds (e.g., $600 in some states) — Stripe typically handles state filings; do not hardcode the federal number as a promise in the ToS.

**Citation:** I.R.C. § 6050W, as amended by the One, Big, Beautiful Bill Act (P.L. 119-21, 2025); IRS FS-2025-08 FAQs.
**Drives:** ToS — Taxes clause (sellers responsible for their own income taxes; platform/processor may collect TIN and issue 1099-K where legally required); Privacy Policy — tax-information collection and IRS disclosure.
**Source:** https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000 ; https://www.irs.gov/businesses/understanding-your-form-1099-k ; https://www.irs.gov/newsroom/form-1099-k-faqs-general-information

---

## 9. California Marketplace Facilitator Act (AB 147) — CDTFA

- Since **October 1, 2019**, a **marketplace facilitator** registered (or required to register) with CDTFA is **the retailer** for every retail sale of tangible personal property it **facilitates** for marketplace sellers — it must **collect and remit** California sales/use tax on those sales; the marketplace seller is relieved of that liability on facilitated sales.
- **Facilitator definition** fits this platform squarely: contracts with sellers to facilitate sales through a marketplace it operates + transmits offers/acceptances + **processes payments** (any one supporting activity suffices).
- **Registration threshold:** register when total combined California sales (own + facilitated + related persons) exceed **$500,000** in the preceding or current calendar year — or immediately if there is any California physical presence (the company is a California corporation, so it registers from the first taxable sale; the $500k economic-nexus test is what matters for other states).
- Register with CDTFA for a **seller's permit** (in-state) or Certificate of Registration—Use Tax (remote).
- **Multistate note:** every state with a statewide sales tax (45 states + DC) now has a marketplace-facilitator law with its own economic-nexus threshold (commonly $100,000 in sales) — the ToS tax clause should be state-agnostic: "where marketplace facilitator laws apply, the platform calculates, collects, and remits sales tax on facilitated sales."
- Used-goods note: used clothing sold at retail in California is generally taxable; occasional-seller exemptions don't survive the facilitator regime for facilitated sales.

**Citation:** Marketplace Facilitator Act, Cal. Rev. & Tax. Code §§ 6040–6049.5 (AB 147, 2019; amended SB 92).
**Drives:** ToS — Fees & Taxes clause (platform collects/remits sales tax on facilitated sales as marketplace facilitator; buyers see tax at checkout; sellers relieved on facilitated sales).
**Source:** https://www.cdtfa.ca.gov/industry/MPFAct.htm

---

## 10. DMCA § 512 — Copyright Safe Harbor for User Listings

- Safe harbor (17 U.S.C. § 512(c)) shields the platform from monetary liability for user-posted infringing content (listing photos/text) only if it: (1) has **no actual knowledge** or awareness of facts making infringement apparent ("red flags") and acts **expeditiously to remove** upon knowledge; (2) receives **no financial benefit directly attributable** to infringement it has the right and ability to control; (3) on proper notice, **expeditiously removes/disables** the material; and (4) has **designated an agent** to receive notifications.
- **Designated agent — mandatory mechanics (verified on copyright.gov):** registration is **electronic-only** via the Copyright Office's DMCA Designated Agent Directory (paper not accepted); **fee: $6 per designation, amendment, or resubmission**; designation **expires three years after registration** unless renewed/resubmitted — an expired designation forfeits safe-harbor eligibility. The agent's contact information must also be made **available to the public on the service provider's website** (statutory § 512(c)(2) requirement).
- **Repeat-infringer policy (§ 512(i)(1)(A)):** safe harbor is conditioned on adopting, **reasonably implementing, and informing users of** a policy providing for **termination of repeat infringers** in appropriate circumstances — this must appear in the ToS, not just internally.
- Include the statutory notice elements (§ 512(c)(3)) and the counter-notification process (§ 512(g)) with the 10–14 business-day restoration window; misrepresentation liability under § 512(f) cuts both ways.
- Interplay with counterfeit screening: trademark counterfeits are NOT covered by the DMCA (copyright only) — the ToS should pair the DMCA policy with a separate IP/brand complaints procedure (trademark) so brand takedowns don't get shoehorned into DMCA mechanics.

**Citation:** 17 U.S.C. § 512(c), (g), (i); 37 C.F.R. § 201.38 (agent designation rule).
**Drives:** ToS — full "Copyright/DMCA Policy" clause (agent contact, notice elements, counter-notice, repeat-infringer termination) + separate trademark/counterfeit complaint clause; operational: register agent before launch, calendar the 3-year renewal.
**Source:** https://www.copyright.gov/dmca-directory/ ; https://www.copyright.gov/dmca-directory/faq.html

---

## 11. COPPA — Children Under 13 (short section)

- COPPA applies to child-directed services **and to general-audience services with actual knowledge** they have collected personal information from a child under 13 — an 18+ ToS does not exempt the platform from the actual-knowledge standard. Amended COPPA Rule effective **June 23, 2025** (tightened consent, data-retention limits, third-party disclosure consent).
- Required posture for an 18+ platform: state the service is not directed to children, that the platform does not knowingly collect PI from children under 13 (nor from anyone under 18 per eligibility rules), and that discovered under-13 data is **deleted promptly** — plus a parent contact channel. Maintain an internal delete-on-discovery procedure; do not merely recite it.

**Citation:** 15 U.S.C. §§ 6501–6506; 16 C.F.R. Part 312 (COPPA Rule, as amended eff. June 23, 2025).
**Drives:** Privacy Policy — "Children's Privacy" section; ToS — eligibility clause cross-reference.
**Source:** https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy

---

## 12. CPSC — Recalled and Non-Compliant Products (prohibited-items clause)

- **It is unlawful to sell or resell any recalled consumer product** — Consumer Product Safety Act § 19, **15 U.S.C. § 2068**, prohibits sale/offer for sale of products subject to a CPSC recall (also: banned products and products failing applicable safety standards, incl. children's product standards — e.g., pre-2011 drop-side cribs, non-compliant infant sleep products, children's items with lead/small-part violations). This applies to resellers and secondhand sales; CPSC states resellers are responsible for knowing whether a product has been recalled and actively monitors online marketplaces.
- Platform posture: prohibited-items clause must ban recalled/banned/non-compliant products; require sellers to check **cpsc.gov/recalls** before listing; reserve removal rights; note reports via SaferProducts.gov. For a fashion marketplace the practical hit is children's apparel (drawstring recalls, flammability standards for sleepwear) and accessories — even an adult-fashion platform should keep the clause generic.

**Citation:** 15 U.S.C. § 2068(a)(2)(B)–(D) (CPSA § 19).
**Drives:** ToS — Prohibited Items clause (recalled/banned/non-compliant products; seller certification of compliance; platform removal rights).
**Source:** https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products

---

## 13. California Automatic Renewal Law — Bus. & Prof. Code § 17600 et seq.

- **Current posture: NOT triggered.** Boosts are one-time, non-recurring purchases. State that expressly in the ToS ("Boosts are one-time paid promotions and do not renew") to keep the ARL off the table.
- If subscriptions or auto-renewing boosts are ever added, § 17602 (as amended by **AB 2863, applying to contracts entered, amended, or extended on/after July 1, 2025**) requires: (1) clear-and-conspicuous disclosure of renewal terms **immediately adjacent to the consent mechanism** + separate **affirmative consent** to the autorenewal itself; (2) a retainable acknowledgment with terms, cancellation policy, and how to cancel; (3) **online cancellation at least as easy as signup** — prominent "click to cancel" link/button or pre-formatted email, without forced steps; (4) renewal reminders — 3–21 days before a free trial/promotional period of 31+ days converts, and annual reminders for yearly plans; fee-change notice 7–30 days ahead.
- Note: the FTC's federal "Click-to-Cancel" Negative Option Rule was vacated by the Eighth Circuit in July 2025, which makes state ARLs (California's is the strictest) the operative regime.

**Citation:** Cal. Bus. & Prof. Code §§ 17600–17606 (as amended by AB 2863, eff. July 1, 2025).
**Drives:** ToS — Boosts/paid-features clause ("one-time, non-refundable except as stated, non-renewing"); future-proofing note for any subscription launch.
**Source:** https://law.justia.com/codes/california/code-bpc/division-7/part-3/chapter-1/article-9/section-17602/

---

## 14. E-SIGN Act / UETA — Electronic Acceptance

- 15 U.S.C. § 7001(a): a signature, contract, or record "may not be denied legal effect, validity, or enforceability solely because it is in electronic form"; California's UETA (Cal. Civ. Code § 1633.1 et seq.) mirrors this — so clickwrap acceptance of the ToS is enforceable **if** the user gets reasonable notice of the terms and takes an affirmative act (checkbox/"I agree" button adjacent to a conspicuous ToS hyperlink); California courts routinely refuse to enforce browsewrap. Include an electronic-communications consent clause (delivery of notices/1099s/disclosures electronically, with hardware/software requirements and withdrawal method for E-SIGN consumer-disclosure compliance).

**Citation:** 15 U.S.C. § 7001 (E-SIGN); Cal. Civ. Code §§ 1633.1–1633.17 (UETA). (UETA cite from statute; not separately fetched.)
**Drives:** ToS — Acceptance/formation clause (clickwrap), Electronic Communications & Consent clause; signup-flow UI requirement.
**Source:** https://www.law.cornell.edu/uscode/text/15/7001

---

## 15. Additional Items a CA Resale Marketplace Must Reflect

- **SB 478 / SB 1524 "Honest Pricing" (hidden/junk fees)** — Cal. Civ. Code § 1770(a)(29), effective July 1, 2024: unlawful to advertise/display/offer a price that "does not include all mandatory fees or charges" other than government taxes and reasonable shipping. Applies to online platforms. **Any mandatory buyer-side service fee must be inside the displayed item price**, not added at checkout; truly optional fees (e.g., optional authentication add-on) may be separate. Drives ToS fees clause AND checkout UI. Source (fetched): https://oag.ca.gov/hiddenfees
- **SB 707 arbitration-fee rule** — Cal. Civ. Proc. Code §§ 1281.97–1281.98: in consumer/employment arbitration, the drafting party must pay filing/arbitration fees **within 30 days of the due date** or is in material breach — the consumer may withdraw to court and obtain sanctions/fees. **Upheld against FAA preemption by the California Supreme Court in Hohenshelt v. Superior Court (Aug. 2025)**, narrowed only by an excusable-neglect safety valve (burden on the late payer). Drives arbitration clause drafting: commit to fee-payment timing, build internal invoice SLAs. Source (fetched): https://www.dlapiper.com/en-us/insights/publications/2025/08/california-supreme-court-upholds-faa
- **McGill v. Citibank, 2 Cal.5th 945 (2017)** — a contract term waiving the right to seek **public injunctive relief in any forum** is unenforceable in California. Arbitration clause needs a McGill carve-out (public-injunctive-relief claims may proceed in court) and careful severability language (avoid "poison pill" that nukes the whole clause). *Settled case law; not separately fetched — flag for counsel confirmation of current drafting practice.*
- **Consumer review protections** — Cal. Civ. Code § 1670.8 (AB 2365) and the federal Consumer Review Fairness Act, 15 U.S.C. § 45b: a form contract may not waive the consumer's right to make any statement about the seller/platform, or penalize reviews; such clauses are void and penalized. The ToS content/reviews section must not prohibit or punish honest reviews (moderation for unlawful/defamatory content remains fine). *Statutory; not separately fetched — flag.*
- **Proposition 65** — warnings for listed-chemical exposures must reach California buyers **before purchase**: for internet sales, on the product display page or via a clearly labeled "WARNING"/"CA WARNING" hyperlink, or otherwise prior to completing the purchase (27 C.C.R. § 25602(b)). 2025 amendments (effective Jan. 1, 2025; unlimited transition to Jan. 1, 2028) require **short-form warnings to name at least one chemical**. Primary duty sits with manufacturers/producers — but jewelry, leather goods, and vinyl accessories commonly carry Prop 65 exposure. C2C posture: ToS requires sellers to include any legally required warnings in listings; platform passes them through and may remove non-compliant listings. Source (fetched): https://www.kelleydrye.com/viewpoints/blogs/kelley-green-law/prop-65-update-big-changes-to-the-short-form-and-internet-warnings
- **Translation requirement** — Cal. Civ. Code § 1632: if a contract is **negotiated primarily in Spanish, Chinese, Tagalog, Vietnamese, or Korean**, the business must deliver a translation of the contract in that language. A self-serve English-only web flow is generally outside it, but it bites the moment the platform runs localized signup/support that "negotiates" in those languages. One-line internal flag; no ToS clause needed now. *Statutory; not separately fetched — flag.*
- **AB 587 content-moderation transparency** (Bus. & Prof. Code § 22675 et seq.): semiannual terms-of-service reports to the CA AG for "social media companies" with **$100M+ gross annual revenue**; partially enjoined on First Amendment grounds (X Corp. v. Bonta, 9th Cir. 2024). Not applicable at launch; revisit if social features + revenue scale. *Not fetched — flag as unstable/litigation-dependent.*
- **Stripe pass-throughs:** Stripe Connect requires the ToS to incorporate the **Stripe Connected Account Agreement / Stripe Services Agreement** for sellers, and Stripe Identity requires disclosure/consent for biometric ID verification (also a CCPA sensitive-PI processing point, §§ 1–2 above). Contractual (Stripe terms), not statutory — include in seller-terms clause.
- Also confirmed baseline: escrow-style release ~3 days post-delivery is a private contractual structure (Stripe handles money transmission licensing) — describe fund-flow timing, chargeback allocation, and that the platform is not a party to the buyer–seller sale contract in the ToS; no separate CA statute fetched for this (money-transmission analysis is Stripe-dependent — flag for counsel if the platform ever holds funds directly).

**Drives:** ToS — pricing/fees display, arbitration clause (SB 707 + McGill carve-out + severability), reviews clause, prohibited/regulated items (Prop 65 warnings), seller terms (Stripe agreements); Privacy Policy — none beyond §§ 1–2.

---

## Could-not-confirm / watch list

1. **Civ. Code § 1789.3 second phone number** ((916) 445-1254) — statute text unfetchable (leginfo robots block); address + (800) number verified via secondary source. Confirm before publishing.
2. **INFORM civil-penalty amount for 2026** — $53,088 is the Jan-2025 adjustment; the 2026 inflation-adjusted figure will be slightly higher (immaterial to drafting).
3. **CPPA OAL approval date** — CPPA page says Sept 22, 2025; Skadden says Sept 23, 2025. Effective date (Jan 1, 2026) and compliance deadlines are consistent across sources.
4. **Risk-assessment Dec 31, 2027 initial-completion date** — from Skadden's summary; White & Case confirmed only the April 1, 2028 submission date. Verify against 11 CCR § 7155 text when drafting the compliance calendar (not a ToS/PP clause).
5. **AB 587** status is litigation-dependent (X Corp. v. Bonta) — recheck before any social-feature launch at $100M+ revenue.
