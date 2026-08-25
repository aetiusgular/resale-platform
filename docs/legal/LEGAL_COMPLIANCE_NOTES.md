# Legal Compliance Notes: ToS + Privacy Policy drafts (2026-08-25)

Internal document. Not user-facing. Hand this to counsel together with
TERMS_OF_SERVICE.md and PRIVACY_POLICY.md. Both drafts were prepared with AI assistance
against the sources below and require attorney review before publication.

## 1. Founder decisions locked on 2026-08-25

1. **Names:** placeholders. Swap [COMPANY LEGAL NAME] (the existing California C corp) and
   [PLATFORM] once the name/domain lands. Full placeholder inventory in § 3.
2. **Scope:** US sellers, worldwide buyers where checkout permits. ToS § 20 fixes the buyer
   as importer of record (DAP), bans sanctioned destinations, bans cross-border exotic
   skins, and carries the EU/UK C2C disclosure (private-seller purchases get no statutory
   withdrawal right).
3. **Disputes:** binding individual JAMS arbitration, FAA-governed, 60-day informal
   resolution condition precedent, class + jury waiver, small-claims and IP carve-outs,
   McGill public-injunctive-relief carve-out, SB 707 fee-timing commitment, 30-day opt-out.
   Modeled on Poshmark's clause architecture (the strongest of the four reviewed).
4. **Returns:** match the built escrow. Final-sale baseline; not-received claims barred
   where tracking shows delivery to the checkout address; 3-day post-delivery window for
   not-as-described claims; counterfeit reports taken anytime (late ones accepted at
   platform discretion); refund is the sole remedy; open claim freezes payout release.
   Mirrors Grailed's 3-day pattern and the platform's actual order state machine (3-day
   auto-release, dispute freeze).

## 2. What the drafts deliberately reflect about the build

- **Fees:** numbers stay OUT of the ToS (all four competitors do this). ToS § 8 points to
  the /fees page, applies fees at time of sale, and promises 14-day notice for changes.
  Current values for the /fees page: seller commission 8.0% base; 7.0% at ≥$3k trailing
  sales and ≥3 orders; 5.5% at ≥$10k and ≥10; 3.5% at ≥$25k and ≥15 (trailing-365-day,
  both gates, non-counting states excluded); welcome ramp: first 10 lifetime sales 0%
  commission with seller covering payment processing (~2.9% + $0.30); shipping charge =
  max(rate quote, category floor) + $2 handling component, buyer-paid; boosts $6/3d,
  $12/7d, $20/14d.
- **Escrow:** release at buyer confirmation or 3 days after tracked delivery, holds for
  open claim / fraud, sanctions review / legal process (ToS § 5.2). 180-day max hold on
  termination (§ 16.5, Depop's pattern). Unclaimed funds escheat to the state, never
  forfeit to the company (§ 5.5; Vestiaire's forfeiture approach is a CA unclaimed-property
  violation, deliberately not copied).
- **Legit Check + auto-auth bot:** ToS § 10 implements the five-prong authenticity
  disclaimer (independent opinions; no brand affiliation, brands may not honor; not a
  certificate; may be wrong; refund sole remedy) from Vestiaire/Poshmark, plus the
  planned-bot constraints from the authentication-system plan: public output limited to
  "no red flags (automated, not a guarantee)", adverse actions get human review + appeal
  (§ 10.4). This matches the CPPA ADMT human-review carve-out and keeps GDPR Art. 22
  inapplicable. Keep the human review real and documented.
- **ML training license:** ToS § 11.2(c) grants an express, scoped license to train
  search/recs/fraud/integrity models on user content (the D-07 item from the recs plan and
  the auth-system plan's "ToS ML-training clause now"). None of the four competitors has an
  express grant; this is deliberately clearer than their "operate our business" language.
  Outward-facing mirror: § 13.1(g) bans scraping and third-party AI training on our data,
  and bans automated purchase agents without human review (Grailed's July-2026-era
  clauses).
- **INFORM Consumers Act:** stated expressly (ToS § 7.7-7.8), unlike all four competitors.
  Platform's $5k-only Stripe Identity trigger is MORE conservative than the statute and is
  presented as "we may verify below statutory thresholds."
- **Bumps/boosts:** § 9 marks boosts one-time and non-renewing (keeps CA Automatic Renewal
  Law dormant), labels promoted placement, discloses ranking (P2B/CRD 6a-ready), and
  reserves per-page caps. Ranking string matches the built ordering: boost → bump →
  recency.
- **Buyer pricing:** § 4.2 commits to no undisclosed mandatory checkout fees (SB 478). See
  § 6 open item on the shipping handling margin.
- **Reviews:** § 11.5 is the Consumer Review Fairness Act / § 1670.8 non-gag clause.
- **Moderation fairness:** cure ladder + statement of reasons + appeal (§§ 16.2-16.4,
  10.4), adapted from Depop. Not legally required in the US today; kept because it matches
  the DSA posture if the EU opens up, and it reads as a trust differentiator.

## 3. Placeholder inventory (fill before publication)

| Placeholder | Where | Notes |
|---|---|---|
| [COMPANY LEGAL NAME] | both docs | exact C corp name from Articles of Incorporation |
| [PLATFORM] | both docs | final brand name |
| [DOMAIN] | both docs | final domain; also fixes /fees, /privacy URLs |
| [PHYSICAL ADDRESS] | both docs | § 1789.3 requires a physical address; registered agent or office |
| [SUPPORT EMAIL], [LEGAL EMAIL], [PRIVACY EMAIL] | both docs | can be one inbox at launch, but keep distinct addresses |
| [DMCA AGENT NAME/EMAIL] | ToS § 14 | must match the Copyright Office registration exactly |
| [REPORT PHONE NUMBER] | ToS § 7.8 | INFORM requires a phone reporting channel; a Twilio number works |
| [ARBITRATION VENUE COUNTY] | ToS § 19 | pick the county of the company's principal office |
| [EFFECTIVE DATE] | both docs | set at publication |
| [EU REPRESENTATIVE], [UK REPRESENTATIVE] | Privacy § 10.1 | only if/when EU-facing (see § 7) |
| PostHog hosting region | Privacy § 3.1 | confirm US vs EU cloud at signup |

## 4. Clause-to-law map (Terms of Service)

| ToS § | Legal basis | Source |
|---|---|---|
| 1.3, 22 | E-SIGN 15 U.S.C. § 7001; Cal. UETA Civ. Code § 1633.1+ (clickwrap; CA courts reject browsewrap) | law.cornell.edu/uscode/text/15/7001 |
| 2.1 | 18+ eligibility; CA minors eraser law B&P §§ 22580-22582 fallback | law.justia.com/codes/california/code-bpc/division-8/chapter-22-1/section-22581/ |
| 2.5, 20.4 | OFAC comprehensive programs (Cuba, Iran, DPRK, Crimea/DNR/LNR; Syria delisted 2025); EAR § 746.8(a)(7) luxury-goods ban Russia/Belarus; Amazon enforcement precedent for screening | ofac.treasury.gov/sanctions-programs-and-country-information; ecfr.gov title 15 part 746 |
| 3 | Marketplace-role/venue doctrine; pattern from Grailed ("not a party", no title), Poshmark ("not an auctioneer, consignee, or shipping carrier"), Vestiaire (intermediation + mandate) | grailed.com/about/terms; poshmark.com/terms; faq.vestiairecollective.com articles 8977898341905 / 8982306039313 |
| 3.3 | Limited payment collection agent (buyer discharge on payment), Poshmark/Vestiaire pattern; supports Stripe separate charges & transfers | poshmark.com/terms § 10 |
| 4.2 | SB 478 / SB 1524 honest pricing, Civ. Code § 1770(a)(29) | oag.ca.gov/hiddenfees |
| 4.3 | CA Marketplace Facilitator Act (AB 147), Rev. & Tax. §§ 6040-6049.5; 45-state equivalents | cdtfa.ca.gov/industry/MPFAct.htm |
| 5.2 | Grailed 3-days-after-delivery payout + enumerated holds; matches built order state machine | grailed.com/about/terms (Seller Terms) |
| 5.5 | CA Unclaimed Property Law: escheat, never forfeit (contrast Vestiaire 5-year forfeiture, Poshmark escheatment clause followed) | poshmark.com/terms § 10(m) |
| 6 | Buyer protection windows: Grailed 3-day / Vestiaire 72h precedent; tracking-confirmed-delivery INR bar; refund-as-sole-remedy | grailed.com/about/terms; faq.vestiairecollective.com Buyer T&C §§ 10, 13 |
| 7.7-7.8 | INFORM Consumers Act 15 U.S.C. § 45f: 200 tx AND $5k new/unused trigger; 10-day collect/verify; annual certification; MANDATORY suspension; $20k disclosure tier; phone + electronic reporting channel | law.cornell.edu/uscode/text/15/45f; ftc.gov/business-guidance/resources/informing-businesses-about-inform-consumers-act |
| 7.9 | 1099-K: OBBBA restored >$20,000 AND >200 transactions for TY2025+; do not hardcode numbers in user-facing docs | irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000 |
| 8 | Fee page incorporated by reference (all four competitors); 14-day change notice (fairer than Poshmark's "without notice"; P2B-ready 15-day if EU business sellers ever join) | competitors.md synthesis |
| 9 | CA Automatic Renewal Law B&P § 17600+ dormant (one-time boosts); P2B Art. 5 / CRD 6a ranking transparency posture | law.justia.com/codes/california/code-bpc/division-7/part-3/chapter-1/article-9/section-17602/ |
| 10 | Vestiaire five-prong authenticity disclaimer; Poshmark "sole remedy" + process-pass framing; Depop "AI output is a suggestion"; CPPA ADMT human-review carve-out; avoids trade-libel exposure by keeping negative bot verdicts private + human-reviewed | faq.vestiairecollective.com Buyer T&C § 6.2; poshmark.com/terms § 11(a); cppa.ca.gov/regulations/ccpa_updates.html |
| 11.5 | Consumer Review Fairness Act 15 U.S.C. § 45b; Cal. Civ. Code § 1670.8 | research file us-ca.md § 15 |
| 12(c) | CPSA § 19, 15 U.S.C. § 2068 recalled-products resale ban | cpsc.gov Stop-Online-Sale-of-Recalled-Products |
| 12(d), 20.5 | CITES/FWS: permits + Form 3-177 + designated ports make C2C export impractical; domestic-only rule | fws.gov/program/office-of-law-enforcement/information-importers-exporters |
| 12(i) | Prop 65 internet-sale warning pass-through (27 CCR § 25602(b); 2025 short-form amendments) | kelleydrye.com Prop-65 update (secondary) |
| 14 | DMCA 17 U.S.C. § 512(c),(g),(i): electronic-only agent registration, $6, 3-YEAR EXPIRY; repeat-infringer policy must be public; separate trademark channel (DMCA is copyright-only) | copyright.gov/dmca-directory/ |
| 16 | Depop cure/notice/immediate ladder + statement of reasons + 180-day fund hold | depophelp.zendesk.com article 360001773148 §§ 8.10, 14 |
| 18.2 | Civ. Code § 1542 waiver for user-vs-user releases (Poshmark pattern) | poshmark.com/terms § 12 |
| 19 | JAMS consumer arbitration (Poshmark architecture); SB 707 fee timing §§ 1281.97-.98 upheld in Hohenshelt (Aug 2025); McGill v. Citibank carve-out; FAA; 30-day opt-out | poshmark.com/terms § 13; dlapiper.com Hohenshelt alert |
| 20.2 | Buyer as importer of record (DAP); EU €150 duty relief ENDS 1 Jul 2026 (€3/category interim levy; VAT due on everything, IOSS ≤€150); US $800 de minimis suspended (permanent 1 Jul 2027) | consilium.europa.eu 2026-02-11 press release; federalregister.gov 2026-12670 |
| 20.6 | Omnibus Directive / CRD Art. 6a: trader-vs-private disclosure + "EU consumer rights do not apply" notice; Vestiaire professional/non-professional pattern | eur-lex CELEX 02011L0083; faq.vestiairecollective.com Buyer T&C § 4 |
| 21 | Cal. Civ. Code § 1789.3 consumer notice; DCA Complaint Assistance Unit, 1625 North Market Blvd., Suite N 112, Sacramento, CA 95834, (800) 952-5210 | legalclarity.org secondary source; see § 6 open item |
| 23 | 14-day advance notice of material changes; arbitration-change carve-out (standard consumer practice; contrast Vestiaire immediate-effect changes) | competitors.md synthesis |

## 5. Clause-to-law map (Privacy Policy)

| Privacy § | Legal basis | Source |
|---|---|---|
| whole doc | CalOPPA B&P §§ 22575-22579: applies from day one, NO threshold; requires categories, third-party categories, review/change process, change-notice process, effective date, DNT response disclosure, third-party tracking disclosure | law.justia.com/codes/california/code-bpc/division-8/chapter-22/section-22575/ |
| 1.1 (identity verification) | Stripe Identity processes ID docs/biometrics; CPPA risk-assessment trigger once CCPA-covered (sensitive PI); disclose vendor role | cppa.ca.gov/regulations/ccpa_updates.html |
| 2.2-2.4 | CPPA ADMT final regs (eff. 1 Jan 2026): behavioral ads/personalization EXCLUDED from ADMT; automated suspensions need documented human review to stay outside "significant decision" scope (compliance date 1 Jan 2027) | cppa.ca.gov/regulations/ccpa_updates.html; skadden.com 2025-10 summary |
| 3.1 | Service-provider contracts (CCPA § 1798.140(ag) service-provider terms; GDPR Art. 28 DPAs where applicable). Hetzner: self-managed infra in Germany | vendor list from docs/LAUNCH_SERVICES.md + G11 (Stripe Identity, not Persona) |
| 4.3 | GPC honoring (CCPA regs; Sephora enforcement); DNT disclosure (CalOPPA § 22575(b)(5)-(7)) | oag.ca.gov/privacy/ccpa |
| 8 | CCPA/CPRA §§ 1798.100-1798.199.100: categories (140 taxonomy), rights, no-sale/share statement, request methods + 45-day timing, agents, non-discrimination; sensitive-PI permitted-purpose position (§ 1798.121(a)) avoiding the Limit link | oag.ca.gov/privacy/ccpa |
| 8.8 | Shine the Light § 1798.83 alternative-compliance route (no third-party direct-marketing sharing) | law.justia.com section 1798.83 |
| 9 | Other state comprehensive laws: access/correct/delete/portability + appeal rights | research file us-ca.md § 1 (multistate note) |
| 10 | GDPR Arts. 3(2), 6, 13/14, 15-22, 27; EDPB Guidelines 3/2018 (targeting/monitoring); Art. 22 avoided via meaningful human review; transfers: SCCs + DPF (upheld by General Court 3 Sep 2025, CJEU appeal C-703/25 P pending); Hetzner backflow EU→US needs SCC Module 4 or DPF + Art. 28 DPA | edpb.europa.eu Guidelines 3/2018; commission.europa.eu EU-US data transfers page |
| 10 (UK) | UK GDPR mirror + PECR cookies; DUAA 2025 (commenced 5 Feb 2026): first-party analytics consent exception with opt-out; UK-rep requirement NOT confirmed removed | ico.org.uk PECR cookies guidance; faegredrinker.com DUAA summary |
| 11 | COPPA 15 U.S.C. §§ 6501-6506 (Rule amended eff. 23 Jun 2025); B&P § 22581 eraser | ftc.gov childrens-privacy |
| (not drafted) | Canada PIPEDA + Quebec Law 25 and Australia get one-line coverage via § 9/§ 10 patterns only if those markets are targeted; revisit at expansion | priv.gc.ca; research file international.md § 12 |

## 6. Open items for counsel (verify before publication)

1. **§ 1789.3 phone number:** address + (800) 952-5210 verified via secondary sources;
   confirm the commonly cited (916) 445-1254 against the statute text (leginfo blocked
   automated fetch).
2. **Shipping handling margin vs SB 478:** the buyer-paid shipping charge includes a $2
   platform handling component. SB 478 excludes "reasonable shipping costs" from the
   all-in-price rule; a margin above actual carriage cost arguably exceeds pure shipping.
   Draft mitigates by disclosing the handling component in the ToS (§ 4.4) and Fee
   Schedule. Counsel to bless the characterization or fold the margin into item pricing.
3. **UK representative:** confirm whether the Data (Use and Access) Act 2025 retained the
   UK-rep duty before appointing or omitting one.
4. **DPF reliance:** decide whether to self-certify to the EU-U.S. Data Privacy Framework
   (FTC-jurisdiction C corp qualifies) or run SCCs-only; CJEU appeal C-703/25 P pending.
5. **Arbitration venue county + JAMS consumer minimum standards:** confirm the venue
   county and that the clause tracks current JAMS minimums (fee caps, consumer election).
6. **1099-K filer:** confirm with Stripe that Stripe files 1099-Ks for connected accounts
   under separate charges & transfers, and who files state-threshold forms.
7. **INFORM build gap:** the platform triggers verification at $5k alone (conservative),
   but the statutory machinery still needs: (a) tracking the 200-transactions-AND-$5k
   new/unused test (requires a new/unused condition flag per listing), (b) the $20k-seller
   identity disclosure surface, (c) annual certification flow, (d) the phone reporting
   channel, (e) 10-day suspension automation, (f) the conspicuous phone + electronic
   reporting mechanism on each covered seller's listing page (the statute requires it on
   the listing surface, not just in the ToS). None of this is fully built; it is dormant
   until sellers scale. Confirm timeline tolerance.
8. **Money transmission:** escrow-style holds run entirely on Stripe Connect (separate
   charges & transfers); platform never holds funds directly. Confirm no state MTL
   exposure under current Stripe structure.
9. **Insurance:** consider media/tech E&O and product-liability posture for the
   marketplace once volume justifies.
10. **Poshmark privacy policy:** competitor capture failed (SPA served ToS twice); not
    relied on. Grailed/Depop/Vestiaire privacy policies were captured and used.
11. **Vestiaire Seller T&C tail** (§ 11.2+) truncated in capture; suspension mechanics
    were taken from the buyer doc + Depop instead.
12. **Buyer rewards program:** if rewards or loyalty perks are conditioned on personal
    information collection or retention, CCPA § 1798.125 may require a notice of
    financial incentive (opt-in consent + withdrawal right + value estimate). Counsel to
    review the program copy before enabling BUYER_REWARDS_ENABLED.

## 7. EU go/no-go package (before actively targeting EU/UK)

Accepting occasional EU buyers with US-directed marketing keeps regulatory weight low.
Before EUR pricing, EU marketing, EU ad spend, or promoting EU shipping, complete: GDPR
Art. 27 EU representative + UK rep decision (§ 6.3); DSA Art. 13 legal representative (no
small-company exemption; bundle with the Art. 27 provider); cookie-consent banner for
EEA/UK visitors (PECR/ePrivacy; Quebec opt-in if Canada targeted); IOSS/deemed-supplier
analysis for ≤€150 consignments (EU VAT) + the 1 Jul 2026 €3-per-category interim duty in
buyer-facing copy; trader self-declaration + badge flow (CRD Art. 6a; ToS § 20.6 already
carries the disclosure language); P2B duties the moment one EU-established business seller
joins (15-day T&C change notice, ranking transparency: § 8.3's 14-day notice and § 9.4's
ranking disclosure were drafted to be nearly compliant already); DSA Arts. 30-32 trader
traceability only after outgrowing micro/small-enterprise thresholds.

## 8. Pre-launch operational checklist (from these docs)

- [ ] Register DMCA agent at copyright.gov ($6, electronic; expires every 3 years;
      calendar the renewal) and publish the same contact in ToS § 14.
- [ ] Set up the INFORM reporting phone number (Twilio) + route to support.
- [ ] CDTFA seller's permit registration (CA physical presence = register from first
      taxable sale); enable marketplace-facilitator tax collection (Stripe Tax) before
      first sale.
- [x] /fees page BUILT (2026-08-25): renders live from lib/fees.ts + lib/boosts.ts +
      lib/shipping.ts constants (single source of truth, cannot drift from checkout);
      time-of-sale + 14-day-notice language on-page.
- [ ] Implement GPC signal handling (even as a no-op acknowledgment while nothing is
      sold/shared) + the privacy request channel (settings + [PRIVACY EMAIL] + form).
- [ ] Data Processing Agreements: Supabase, Vercel, Stripe, Twilio, Resend, PostHog,
      Sentry, EasyPost standard DPAs; Hetzner DPA + SCCs for the recs VPS.
- [ ] Confirm PostHog data residency; mask sensitive fields if session replay is enabled
      (Privacy § 1.2 says "with sensitive input fields masked": make it true).
- [ ] Clickwrap: signup must show "I agree to the Terms of Service and Privacy Policy"
      with links + affirmative action; log acceptance timestamp + version.
- [x] Public /terms + /privacy routes BUILT (2026-08-25; generated from docs/legal/*.md
      via scripts/generate-legal.mjs, DRAFT banner on-page) and linked from the /enter
      footer with the word "Privacy" (CalOPPA conspicuous posting). Add the same links to
      any future site-wide footer, and remove the DRAFT banners only after counsel
      sign-off + placeholders are filled.
- [ ] Wire the 30-day arbitration opt-out inbox ([LEGAL EMAIL]) and an internal SLA for
      SB 707 arbitration-fee payment deadlines.
- [ ] Sanctions screening: block embargoed-jurisdiction checkout/shipping (Cuba, Iran,
      DPRK, Crimea/DNR/LNR), no Russia/Belarus shipping (EAR luxury ban), SDN name/address
      screening on payouts (Stripe covers card side; shipping side is ours), IP-geo
      controls, decision logging (OFAC Amazon precedent).
- [ ] Escheatment process for unclaimed payouts (state unclaimed-property filings), not
      forfeiture.
- [ ] Keep human review documented for every automated-screening enforcement action
      (CPPA ADMT carve-out + GDPR Art. 22 posture + ToS § 10.4 promise).
- [ ] When the auto-auth bot goes public: positive-only public output ("no red flags
      (automated, not a guarantee)"), negatives private + human-reviewed + appealable;
      IP/T&S counsel signs off on bot copy before any public post (per the
      authentication-system plan).

## 9. Primary sources relied on

**California / US government:** oag.ca.gov/privacy/ccpa · oag.ca.gov/hiddenfees ·
cppa.ca.gov/regulations/ccpa_updates.html · cdtfa.ca.gov/industry/MPFAct.htm ·
copyright.gov/dmca-directory/ · ftc.gov/business-guidance/resources/informing-businesses-about-inform-consumers-act ·
ftc.gov/business-guidance/privacy-security/childrens-privacy ·
irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000 ·
cpsc.gov (Stop Online Sale of Recalled Products) · law.cornell.edu/uscode/text/15/45f ·
law.cornell.edu/uscode/text/15/7001 · ofac.treasury.gov/sanctions-programs-and-country-information ·
ecfr.gov (15 CFR part 746) · fws.gov/program/office-of-law-enforcement/information-importers-exporters ·
federalregister.gov/documents/2026/06/24/2026-12670 (de minimis suspension) ·
California statutes via Justia mirrors (leginfo blocks automated fetch): B&P 22575-22579,
22580-22582, 17600-17606; Civ. Code 1798.83, 1789.3 (secondary), 1670.8, 1770(a)(29).

**EU / UK / international:** eur-lex.europa.eu (DSA 2022/2065, CRD 02011L0083, P2B
2019/1150, GPSR 2023/988) · edpb.europa.eu (Guidelines 3/2018, 05/2021) ·
commission.europa.eu (EU-US data transfers; SCCs) · ico.org.uk (PECR cookies; ADM guidance)
· vat-one-stop-shop.ec.europa.eu · taxation-customs.ec.europa.eu +
consilium.europa.eu (€150 threshold removal, final approval 11 Feb 2026) ·
priv.gc.ca (PIPEDA).

**Competitor terms reviewed via Claude in Chrome (2026-08-25):**
Grailed ToS grailed.com/about/terms · Grailed Privacy grailed.com/about/privacy ·
Poshmark ToS poshmark.com/terms (privacy capture failed) ·
Depop ToS depophelp.zendesk.com/hc/en-gb/articles/360001773148 (July 2026 version) ·
Depop Privacy depophelp.zendesk.com/hc/en-gb/articles/360001792147 ·
Vestiaire Buyer T&C faq.vestiairecollective.com/hc/en-us/articles/8977898341905 ·
Vestiaire Seller T&C faq.vestiairecollective.com/hc/en-us/articles/8982306039313 ·
Vestiaire Privacy faq.vestiairecollective.com/hc/en-gb/articles/8998681464081.

Full research notes: /research/us-ca.md, /research/international.md,
/research/competitors.md (delivered alongside these files).
