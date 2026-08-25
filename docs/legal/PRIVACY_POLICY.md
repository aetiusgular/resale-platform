# [PLATFORM] Privacy Policy

> **DRAFT FOR ATTORNEY REVIEW. NOT YET IN EFFECT.**
> Prepared 2026-08-25. This draft was prepared with AI assistance and is not legal advice.
> A licensed attorney must review it before publication. Bracketed placeholders to fill:
> [COMPANY LEGAL NAME], [PLATFORM], [DOMAIN], [PHYSICAL ADDRESS], [PRIVACY EMAIL],
> [SUPPORT EMAIL], [EFFECTIVE DATE], [EU REPRESENTATIVE], [UK REPRESENTATIVE].
> Companion documents: Terms of Service, LEGAL_COMPLIANCE_NOTES.md.

**Effective date: [EFFECTIVE DATE]**

This Privacy Policy describes how [COMPANY LEGAL NAME], a California corporation
("[PLATFORM]", "we", "us", "our"), collects, uses, and discloses information about you when
you use our website at [DOMAIN], our applications, and related services (the "Services").

The short version: we collect what we need to run a secondhand fashion marketplace
(your account, listings, transactions, messages, and how you use the platform), we use it
to run transactions, personalize your feed, fight fraud and counterfeits, and meet legal
duties, we share it with the service providers that make the platform work, and **we do not
sell your personal information or share it for cross-context behavioral advertising.** The
details follow, and the summary above does not replace them.

## 1. Information We Collect

### 1.1. Information you provide

- **Account and profile.** Name, username, email address, phone number, password
  (stored hashed; we cannot read it), profile photo and bio, sizing and style preferences,
  and your age confirmation. Two-factor authentication details (such as a verified phone
  number) are part of your account security setup.
- **Listings and sales content.** Photos, videos, titles, descriptions, brand, category,
  size, condition, and price of Items you list, plus any content you post in Legit Check
  threads, reviews, or other public areas.
- **Messages and offers.** Direct messages with other users, offers and counteroffers,
  and communications with our support team.
- **Transaction and shipping details.** Purchases, sales, order status, shipping addresses
  (buyer delivery address, seller ship-from address), and delivery confirmations.
- **Payment information.** Handled by Stripe: card and bank details go directly to Stripe,
  and we do not receive or store full card numbers or bank credentials. We receive
  transaction outcomes, payout status, and limited instrument metadata, including hashed
  instrument fingerprints used for fraud prevention (Section 2.3).
- **Identity verification.** Where verification is required (see the Terms of Service),
  it is performed by Stripe Identity. Government ID images and biometric identifiers
  derived from them (such as a selfie match) are collected and processed by Stripe; we
  receive the verification result and limited verified attributes, not your document
  images.
- **Tax and compliance information.** Taxpayer identification and related information for
  IRS Form 1099-K and INFORM Consumers Act compliance, collected directly or through
  Stripe.

### 1.2. Information collected automatically

- **Device and log data.** IP address, browser and device type, operating system, language,
  referring pages, and timestamps.
- **Usage events.** Actions on the Services such as searches, listings viewed, favorites,
  follows, saved searches, offers, bumps, boosts, purchases, and session activity. These
  events power analytics and the personalization described in Section 2.2.
- **Cookies and similar technologies.** Session cookies for sign-in and security, and
  analytics identifiers (Section 4).
- **Analytics and diagnostics.** Product analytics via PostHog and error and performance
  diagnostics via Sentry. Analytics may include replays of your interactions with the
  Services with sensitive input fields masked.

### 1.3. Information from other sources

- **Sign-in providers.** If you sign in with Google, we receive your name, email address,
  and profile photo from Google per your Google settings.
- **Payment and verification partners.** Fraud signals, verification outcomes, and account
  status from Stripe.
- **Shipping partners.** Tracking and delivery status from shipping providers and carriers.
- **Other users.** Content that references you, such as reviews of a transaction with you
  or reports submitted about your listings.

## 2. How We Use Information

### 2.1. To run the marketplace

Provide accounts and sign-in (including two-factor authentication via SMS), host listings,
process orders, payments, escrow-style fund holds, payouts, refunds, and disputes, arrange
shipping and prepaid labels, deliver notifications (email via our email provider, web push,
SMS for security codes), and provide customer support.

### 2.2. To personalize the Services

Rank and recommend listings in browse, search, and any "for you" surfaces using your
activity on the Services (views, favorites, searches, purchases, follows), listing
attributes, and popularity signals; deliver saved-search alerts and price-drop
notifications you set up; and administer promotional credits, rewards, and fee tiers tied
to your transaction activity. This is profiling in the GDPR sense; it does not produce legal or
similarly significant effects, and Section 10.3 describes it further for EEA/UK users.

### 2.3. For trust, safety, and integrity

- Detect and prevent fraud, scams, collusion, and abuse, including comparing hashed
  payment-instrument fingerprints across accounts, screening for ship-to-self and related
  collusion patterns, rate limiting, and enforcing our one-account rule.
- Detect duplicate and stolen listing photos (using perceptual hashing and similar
  image-matching techniques against other listings and reference images).
- Screen listings for counterfeit risk and policy violations using automated systems.
  Automated controls may place temporary holds; listing removals and account suspensions
  on authenticity grounds receive human review before they take effect, as described in
  the Terms of Service.
- Review messages and public content with automated filters, and with human review where
  flagged, for fraud prevention, dispute resolution, user safety, and policy enforcement.
- Screen transactions and shipping destinations against sanctions and export-control
  requirements.

### 2.4. To improve the Services and train our models

Analyze usage to understand and improve features and performance, and use listing content
(photos and descriptions) and usage signals to develop, train, evaluate, and improve the
automated systems that power the Services: search, recommendations and personalization,
fraud and abuse prevention, duplicate and stolen-photo detection, and item-integrity and
counterfeit screening. Where feasible we use de-identified or aggregated data for these
purposes.

### 2.5. To communicate with you

Send transactional and account messages (orders, offers, shipping, security, policy and
legal updates), which you cannot opt out of while you hold an account, and marketing
communications (such as newsletters or feature announcements), which you can opt out of at
any time via the unsubscribe link or settings.

### 2.6. To meet legal obligations

Tax reporting (including Form 1099-K where thresholds are met), INFORM Consumers Act
collection, verification, disclosure, and reporting duties, marketplace facilitator sales
tax, sanctions compliance, responding to lawful requests from authorities, and
establishing, exercising, or defending legal claims.

## 3. How We Disclose Information

We do not sell personal information, and we do not share it for cross-context behavioral
advertising. We disclose information as follows.

### 3.1. Service providers (processors)

Providers that process personal information on our behalf, engaged under data-protection
terms that limit their use of it:

| Provider | Function | Location |
|---|---|---|
| Supabase | Database, authentication, file storage | United States |
| Vercel | Application hosting and delivery | United States |
| Stripe | Payments, payouts, identity verification, fraud prevention, tax forms | United States |
| Twilio | SMS delivery for phone verification and security codes | United States |
| Resend | Transactional email delivery | United States |
| Google | Sign-in (OAuth) where you choose it | United States |
| EasyPost and carriers (USPS, UPS, FedEx and similar) | Shipping labels, tracking, delivery | United States and destination countries |
| PostHog | Product analytics | United States [confirm hosting region at launch] |
| Sentry | Error and performance diagnostics | United States |
| Self-managed infrastructure (Hetzner) | Recommendation and screening backend | Germany |

Stripe also acts as an independent controller for some processing (such as its own fraud
prevention, KYC, and regulatory obligations) as described in Stripe's privacy policy. When
identity verification runs, your ID document data is processed by Stripe under its terms.
Google (for sign-in) and the shipping carriers likewise act as independent controllers of
the data they process to provide their own services.

### 3.2. Other users and the public

- **Public by design:** your username, profile photo and bio, listings (including photos,
  descriptions, and price), Legit Check threads, reviews you give and receive, follower and
  following lists, and general activity such as items sold.
- **Shared with your counterparty:** when a sale occurs, the seller receives the buyer's
  name and shipping address (on the label or order details) to fulfill the order; buyers
  and sellers see each other's usernames and relevant order information. Users must use
  counterparty information only for the transaction (Terms of Service § 7.10).
- **Required seller disclosures:** for sellers meeting INFORM Consumers Act thresholds,
  federal law requires us to disclose seller identity and contact information to buyers
  (Terms of Service § 7.7).

### 3.3. Legal, safety, and corporate

- Courts, law enforcement, tax and regulatory authorities where required by law or legal
  process, or where disclosure is reasonably necessary to prevent fraud or harm, enforce
  our Terms, or protect the rights, property, or safety of users, the public, or
  [PLATFORM].
- Brand owners or authorities in connection with counterfeit investigations, limited to
  information about the relevant listings and conduct.
- In a merger, acquisition, financing, reorganization, or sale of assets, personal
  information may be transferred as part of the transaction, subject to this Policy's
  commitments.
- Aggregated or de-identified information that does not identify you may be used and
  shared for any lawful purpose; we do not attempt to re-identify it.

## 4. Cookies, Analytics, and Your Signals

4.1. **What we use.** (a) Strictly necessary cookies for sign-in sessions, security, and
fraud prevention; (b) analytics identifiers (PostHog) to understand product usage; and
(c) preference storage. We do not use third-party advertising cookies or pixels.

4.2. **Controls.** Browser settings can block or delete cookies; blocking necessary
cookies breaks sign-in. Where a cookie consent banner is shown (for example to visitors
from the EEA or UK), analytics run only per your choices there.

4.3. **Global Privacy Control and Do Not Track.** We honor Global Privacy Control (GPC)
signals as an opt-out of any sale or sharing of personal information. Because we do not
sell or share personal information, GPC does not change our current practices. We do not
respond to legacy browser "Do Not Track" signals, for which no standard exists (disclosure
per Cal. Bus. & Prof. Code § 22575(b)(5), (b)(6): our analytics and diagnostics providers
collect usage data on our Services on our behalf; we do not permit third parties to collect
personal information across other sites over time for their own use).

## 5. Retention

We keep personal information only as long as needed for the purposes above, then delete or
de-identify it. Criteria and typical periods:

- **Account data:** while your account is active, then deleted or de-identified within a
  reasonable period after closure, except as below.
- **Transaction, payout, tax, and INFORM records:** retained as required by tax,
  accounting, and marketplace regulation (typically 7 years).
- **Identity verification:** document and biometric data are held by Stripe under its
  retention rules; we retain the verification outcome and status.
- **Messages and disputes:** retained while relevant to open transactions, claims, or
  enforcement, and for limitation periods where a dispute exists.
- **Fraud and enforcement records:** retained as needed to prevent repeat abuse (for
  example, records supporting a ban, including hashed instrument fingerprints).
- **Logs and analytics:** retained on rolling windows (typically 12 to 24 months), then
  deleted or aggregated.
- **Backups:** deleted data may persist in encrypted backups until those backups rotate
  out on their schedule.

## 6. Security

We use technical and organizational safeguards appropriate to the data we handle:
encryption in transit, row-level access controls in our database, least-privilege access
for administrative functions, hashed passwords, two-factor authentication on every
account, and vendor diligence on the providers in Section 3.1. No system is perfectly
secure; if a breach affecting your personal information requires notice, we will notify
you and regulators as the law requires.

## 7. Your Rights and Choices (All Users)

- **Access and update:** your profile, addresses, and preferences are editable in
  settings; you can request a copy of your data at [PRIVACY EMAIL].
- **Delete:** you can request account deletion in settings or at [PRIVACY EMAIL]. We
  retain what Section 5 requires (for example transaction and tax records) and delete or
  de-identify the rest.
- **Marketing opt-out:** unsubscribe links or settings; transactional messages continue
  while you hold an account.
- **Push and SMS:** control push notifications in your device or browser settings; SMS is
  used for security codes tied to your account security setup.
- We will not discriminate against you for exercising privacy rights.

## 8. California Privacy Rights

This Section supplements the rest of the Policy for California residents and is provided
under the California Consumer Privacy Act as amended (CCPA, Cal. Civ. Code § 1798.100 et
seq.) and CalOPPA. [Counsel: CCPA duties attach when the business meets a § 1798.140(d)
threshold; this section is drafted to comply from day one regardless.]

8.1. **Categories collected.** In the last 12 months we have collected the following
categories of personal information (statutory category in parentheses): identifiers such
as name, email, phone, username, IP address (A); customer records such as addresses and
transaction records (B); commercial information such as purchases, sales, favorites, and
offers (D); internet or network activity such as usage events, device data, and
interactions with the Services (F); general location inferred from IP address (G, coarse
only; we do not collect precise geolocation); audio or visual information such as listing
photos and any profile photo (H); professional information only as needed for professional
seller status (I); inferences such as size and style preferences used for personalization
(K); and sensitive personal information limited to government identification data and
derived biometric identifiers processed by our verification provider for required identity
verification, account log-in credentials, and taxpayer identification numbers for tax
compliance (L).

8.2. **Sources** are described in Section 1: you, your devices, our service providers, and
other users.

8.3. **Purposes** are described in Section 2. Sensitive personal information is used only
for the purposes permitted by Cal. Civ. Code § 1798.121 and its implementing regulations
(Cal. Code Regs. tit. 11, § 7027) (providing the Services, verification, fraud prevention,
safety, and legal compliance) and is not used to infer characteristics, so we
do not offer a separate "Limit the Use of My Sensitive Personal Information" link.

8.4. **Disclosures** are described in Section 3, to the categories of recipients listed
there (service providers, counterparties to your transactions, and authorities where
required).

8.5. **No sale or sharing.** We do not sell personal information and we do not share it
for cross-context behavioral advertising, and we have not done either in the preceding 12
months. We do not knowingly sell or share the personal information of anyone under 16. If
this ever changes, we will update this Policy, add the required "Do Not Sell or Share"
link, and honor opt-out preference signals; we treat GPC signals as valid opt-out requests
today (Section 4.3).

8.6. **Your rights.** Subject to verification and legal exceptions, California residents
may: request to know and access the personal information we hold, including categories,
sources, purposes, and specific pieces; request correction of inaccurate information;
request deletion; and receive a portable copy. We will not discriminate against you for
exercising rights.

8.7. **How to exercise rights.** Submit requests through account settings, by email to
[PRIVACY EMAIL], or through the request form at [DOMAIN]/privacy/requests. We verify
requests by matching information you provide against your account (and, where needed,
additional documentation) and respond within the statutory period (generally 45 days,
extendable once). You may use an authorized agent; we require proof of authorization and
may require you to verify your identity directly.

8.8. **Shine the Light.** We do not disclose personal information to third parties for
their own direct marketing purposes (Cal. Civ. Code § 1798.83). California residents may
ask about this practice at [PRIVACY EMAIL].

8.9. **Minors.** The Services are for adults 18 and over. A California minor who
nonetheless posted content may request its removal as described in Section 11.

8.10. **Notification of changes** is described in Section 12; the effective date appears
at the top of this Policy (Cal. Bus. & Prof. Code § 22575(b)(3), (b)(4)).

## 9. Other U.S. State Privacy Rights

Residents of states with comprehensive privacy laws (including Colorado, Connecticut,
Texas, Oregon, Virginia, and others) may have similar rights of access, correction,
deletion, and portability, and the right to opt out of targeted advertising, sale, or
significant profiling. We do not sell personal information, use it for targeted
advertising, or engage in profiling that produces legal or similarly significant effects.
Exercise rights as in Section 8.7; where your state provides an appeal right for refused
requests, you may appeal by replying to our decision, and we will respond per your state's
law.

## 10. Users in the EEA, United Kingdom, and Switzerland

This Section applies if you use the Services from the European Economic Area, the United
Kingdom, or Switzerland, to the extent the GDPR, UK GDPR, or Swiss FADP applies to that
use. [Counsel note: at launch the platform is US-directed with US-based sellers;
worldwide buyers are accepted where checkout permits. This section is drafted to be
accurate if and when the targeting/monitoring tests are met; before actively marketing to
or shipping into the EU/UK at scale, complete the EU go/no-go items in
LEGAL_COMPLIANCE_NOTES.md, including representative appointments.]

10.1. **Controller and representatives.** The controller is [COMPANY LEGAL NAME],
[PHYSICAL ADDRESS], reachable at [PRIVACY EMAIL]. EU representative (Art. 27 GDPR):
[EU REPRESENTATIVE, to be appointed before EU-directed operations]. UK representative:
[UK REPRESENTATIVE, if required; verify under the Data (Use and Access) Act 2025].

10.2. **Legal bases.** We process personal data on these bases: **performance of a
contract** (Art. 6(1)(b)): accounts, listings, transactions, payments and payouts,
shipping, messaging, support; **legitimate interests** (Art. 6(1)(f)): fraud and
counterfeit prevention, platform security and integrity, service improvement and
first-party analytics, personalization of listings surfaces, and protecting our legal
rights, in each case balanced against your interests and rights; **consent** (Art.
6(1)(a)): marketing communications and non-essential cookies, withdrawable at any time
without affecting prior processing; **legal obligation** (Art. 6(1)(c)): tax, sanctions
screening, and lawful requests. Where we rely on legitimate interests you may object
(Art. 21), and we will stop unless compelling legitimate grounds override; we always stop
direct marketing on objection.

10.3. **Automated decision-making and profiling.** Personalized recommendations and
ranking are profiling but produce no legal or similarly significant effects. Automated
counterfeit and fraud screening produces flags and temporary holds; **no listing removal
or account suspension on authenticity grounds takes effect without meaningful human
review**, so those decisions are not based solely on automated processing within Art. 22. You may contest any
enforcement decision, express your point of view, and obtain human re-review (Terms of
Service §§ 10.4, 16.4).

10.4. **International transfers.** We are a U.S. company and process data in the United
States; parts of our recommendation and screening infrastructure run in Germany. For
transfers of EEA/UK/Swiss personal data to the United States we put safeguards in place:
the European Commission's Standard Contractual Clauses with our providers (with the UK
Addendum or IDTA for UK data, and FDPIC-recognized clauses or the Swiss-U.S. DPF extension
for Swiss data), and the EU-U.S. Data Privacy Framework where the receiving provider is
certified [and, if [COMPANY LEGAL NAME] self-certifies, our own certification]. Copies
of relevant safeguards are available on request at [PRIVACY EMAIL].

10.5. **Your rights.** Access (Art. 15), rectification (Art. 16), erasure (Art. 17),
restriction (Art. 18), portability (Art. 20), objection (Art. 21), withdrawal of consent
(Art. 7(3)), and the right to lodge a complaint with your supervisory authority (for the
UK, the ICO). Exercise rights as described in Section 8.7; we respond within one month,
extendable as the law allows.

10.6. **Data we must have.** Account, transaction, and verification data marked as
required is needed to enter or perform the contract (or is legally required); without it
we cannot provide the relevant feature.

## 11. Children and Minors

The Services are not directed to anyone under 18, and users must be 18 or older. We do not
knowingly collect personal information from anyone under 18, and never knowingly from
children under 13 (COPPA, 15 U.S.C. §§ 6501-6506). If we learn we have collected personal
information from a child under 13, we delete it promptly. If you believe a minor has
provided us personal information, contact [PRIVACY EMAIL]; parents or guardians of, or
users who were, California residents under 18 may request removal of content the minor
posted (Cal. Bus. & Prof. Code § 22581), understanding that removal from public view does
not ensure complete removal from all systems.

## 12. Changes to This Policy

We may update this Policy. The effective date at the top shows the current version. For
material changes we will give prominent notice (email to your account address or notice in
the Services) before the change takes effect. Continued use after the effective date means
the updated Policy applies.

## 13. Contact Us

[COMPANY LEGAL NAME]
[PHYSICAL ADDRESS]
Privacy requests and questions: [PRIVACY EMAIL]
General support: [SUPPORT EMAIL]

---

*Document version: DRAFT v1 (2026-08-25). Requires attorney review before publication. See
LEGAL_COMPLIANCE_NOTES.md for the clause-by-clause legal basis, open decisions, and the
pre-launch compliance checklist.*

