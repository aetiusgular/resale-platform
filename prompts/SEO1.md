# SEO1 — Discovery & listing-metadata layer (audit-driven)

READ FIRST: CLAUDE.md, docs/HANDOFF.md. This prompt implements the 2026-08-27
SEO audit. Audit ground truth (verified in code AND live on prod): the rendering
foundation is correct — force-dynamic SSR everywhere, guest-public
/browse /listings/[id] /sellers/[username], real <a> links from cards, per-listing
generateMetadata with OG image. What is MISSING is the entire machine-readable
layer: no JSON-LD anywhere, no sitemap (404s live), no robots.txt (404s live),
no favicon/icons/manifest of any kind (public/ contains only sw.js), no
canonicals/metadataBase, no og:site_name/title template, filler meta descriptions.
This prompt adds that layer. It is HEAD-ONLY work: no visual changes, no
migrations, no money-path or middleware edits.

RUN CONTEXT: .env.local exists (never print/commit). ANTI-HANG rules apply.
Commit locally, no GitHub push. Model: opus. If a dev server is running on
:3000, do NOT run `pnpm build` concurrently (they fight over .next — known
ENOENT spray); run the build check only with the dev server stopped, or leave
the build for the founder.

FOUNDER DECISIONS ALREADY MADE (do not revisit in this prompt):
- Site stays NOINDEX during the vercel.app tester window; indexing turns on by
  env flag at real-domain cutover.
- Sold listings will later become public "SOLD" archive pages (price shown,
  availability SoldOut) — that is SEO2, rides with the HF7 design build, needs
  an RLS migration + db-guard. NOT in scope here. In this phase public listing
  pages only ever render status='active', so availability is always InStock.
- Platform name is TBD. Every human-visible name string must flow through ONE
  constant so the rename is a one-line swap.

────────────────────────────────────────────────────────────────────────────────

## TASK 1 — lib/seo.ts + indexing flag

Create `lib/seo.ts`:
- `export const SITE_NAME = 'Resale Platform'` (placeholder — single swap point).
- `export const SITE_TAGLINE = 'Curated secondhand fashion marketplace'` (reuse
  the existing root description copy).
- `export function baseUrl(): string` → `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`
  (same convention as lib/stripe.ts).
- `export function absUrl(path: string): string` → baseUrl() + path.

Add to `lib/flags.ts` (house pattern, booleans default OFF):
- `SEO_INDEXING_ENABLED` ← `process.env.SEO_INDEXING_ENABLED === 'true'`.
  Server-only is fine (only read in robots/layout/server contexts). Document in
  .env.example: "OFF during the vercel.app tester window; set true at real-domain
  cutover (see LAUNCH_RUNBOOK)".

## TASK 2 — Root layout metadata (app/layout.tsx)

Replace the current two-line metadata export with:
- `metadataBase: new URL(baseUrl())`
- `title: { default: SITE_NAME, template: '%s — ' + SITE_NAME }`
- `description: SITE_TAGLINE`, `applicationName: SITE_NAME`
- `openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_US' }`
- `twitter: { card: 'summary' }` (listing pages already override to large image)
- `robots`: when `!SEO_INDEXING_ENABLED` → `{ index: false, follow: false }`;
  when enabled → `{ index: true, follow: true }`.

IMPORTANT gate semantics (do not "improve" this): deindexing works via META
ROBOTS while robots.txt still ALLOWS crawling — a disallow-all robots.txt would
block Google from ever seeing the noindex and can leave URL-only entries in the
index. robots.txt (Task 6) therefore keeps the same disallow list in both modes
and only gates the sitemap reference.

## TASK 3 — Icons + manifest (there are currently NONE; /favicon.ico 404s)

- `app/icon.svg` — placeholder mark in Night Archive tokens: #131210 square,
  bone #EDE8DC glyph (the "———" wordmark bars work; keep it geometric and
  legible at 16px). No text. This is a placeholder to swap at naming.
- `app/apple-icon.tsx` — 180×180 via `ImageResponse` from `next/og` (zero binary
  assets), same mark scaled up.
- `app/manifest.ts` — name/short_name SITE_NAME, start_url '/browse', display
  'standalone', background_color/theme_color '#131210', icons: the svg
  (sizes 'any') + the apple-icon route. Verify the actual served icon paths from
  the build output rather than guessing.

## TASK 4 — JSON-LD infrastructure + listing page structured data

Create `app/components/json-ld.tsx` (server component):
```tsx
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
```
The `<` escaping is MANDATORY — listing titles/descriptions are user-generated
text and `</script>` injection must be impossible. Note: ld+json is a
non-executing data block; the CSP nonce does not apply to it and none is needed.

Create `lib/seo-listing.ts` (pure, unit-testable) with:
- `schemaCondition(score: number)` → 10 → 'https://schema.org/NewCondition',
  1–9 → 'https://schema.org/UsedCondition'. (Google merchant listings accept
  only New/Refurbished/Used; our 9 "new without tags" is Used by resale norms.)
- `schemaImages(images: string[])` → slots 0–4 only, falsy entries filtered.
  Index 5 is the POSSESSION proof photo (PHOTO_SLOTS in lib/condition.ts) —
  it must NEVER appear in schema, OG, or anything Google Images can pick up.
- `metaDescription(listing)` → listing.description trimmed to ≤160 chars on a
  word boundary with '…'; fallback when description is empty:
  `${title} by ${brand} — size ${size} — ${price}`. (Kills the current
  "on the platform" filler.)
- `centsToPrice(cents: number)` → '123.45' string.

In `app/listings/[id]/get-listing.ts`: add `department, shipping_cents` to the
select (RLS-safe columns, no policy change).

In `app/listings/[id]/page.tsx`:
1. generateMetadata: description ← metaDescription(); add
   `alternates: { canonical: '/listings/' + id }`; openGraph gains
   `url: '/listings/' + id`; OG/Twitter images ← schemaImages() first entry
   (today's code can pick an empty-string slot or the possession photo — fix).
2. Render `<JsonLd>` twice in the page body (public branch only):

   Product:
   - name, description (metaDescription), image: schemaImages(), sku: listing.id,
   - brand: { '@type': 'Brand', name: brand }, category: `${department} > ${category}`,
   - size, itemCondition: schemaCondition(condition_score),
   - offers: { '@type': 'Offer', url: absUrl('/listings/' + id),
     price: centsToPrice(price_cents), priceCurrency: 'USD',
     availability: 'https://schema.org/InStock',
     itemCondition: same as above,
     seller: { '@type': 'Person', name: seller.username },
     shippingDetails: { '@type': 'OfferShippingDetails',
       shippingRate: { '@type': 'MonetaryAmount',
         value: centsToPrice(shipping_cents), currency: 'USD' },
       shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' } } }
   - Do NOT emit hasMerchantReturnPolicy (ToS attorney review pending — leave a
     one-line code comment saying exactly that). No aggregateRating (none exists
     per-item). No GTIN (one-of-a-kind used goods).

   BreadcrumbList: Browse (/browse) › department (/browse?dept=…) › category
   (/browse?dept=…&cat=…) › listing title (no item URL on the last element).
   Use absUrl() for item URLs; match the dept/cat query-param spelling the
   browse page actually parses.

## TASK 5 — Sitemap (app/sitemap.ts)

Use `createServiceClientRaw()` (exists in lib/supabase/service):
- All `status='active'` listings: `{ url: absUrl('/listings/'+id), lastModified: updated_at }`,
  ordered updated_at desc, capped at 50_000.
- Seller pages: distinct usernames of sellers with ≥1 active listing →
  absUrl('/sellers/'+username).
- Statics: /browse, /enter, /fees, /terms, /privacy.
Emit unconditionally (the flag gates indexing, not the file). Everything is
force-dynamic already, so this regenerates per fetch — fine at current scale.

## TASK 6 — Robots (app/robots.ts)

Both modes: `rules: { userAgent: '*', disallow: ['/api/', '/admin/', '/settings',
'/messages', '/checkout', '/orders', '/onboarding', '/saved', '/sell', '/boost',
'/banned', '/reset-password', '/styleguide'] }`.
Only when SEO_INDEXING_ENABLED: add `sitemap: absUrl('/sitemap.xml')`.
(See Task 2 for why disallow-all is wrong when the flag is off.)

## TASK 7 — Page-level metadata sweep

- Strip every hardcoded '— Resale Platform' suffix (browse, saved, sell, boost,
  privacy, fees, terms, orders, banned, styleguide, admin/*, sellers) — the
  layout template now appends the site name. Titles become bare: 'Browse',
  'Saved', 'Terms of Service', etc.
- /browse: `alternates: { canonical: '/browse' }` (ALL filter/sort/offset/q
  permutations canonicalize to clean /browse — facet URLs must never be the
  ranking surface). Also render WebSite + Organization JSON-LD here (this is the
  effective homepage — / redirects to /browse): WebSite { name: SITE_NAME,
  url: baseUrl() } and Organization { name: SITE_NAME, url: baseUrl(),
  logo: absUrl(<apple-icon route>) }. No SearchAction (deprecated).
- /sellers/[username]: description `@${username}'s closet on ${SITE_NAME} —
  secondhand fashion listings`, `alternates: { canonical: '/sellers/'+username }`,
  openGraph title/description/url. Plus ProfilePage JSON-LD:
  { '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name/alternateName:
  username, url: absUrl(...) } }.
- /enter: add a metadata export — title 'Sign in', description SITE_TAGLINE,
  canonical /enter.
- /fees, /terms, /privacy: add canonicals.
- /admin/*, /styleguide, /banned: per-page `robots: { index: false }` (belt to
  the robots.txt suspenders).

## TASK 8 — Runbook + env docs

- .env.example: add SEO_INDEXING_ENABLED with the comment from Task 1.
- docs/LAUNCH_RUNBOOK.md, in the existing "when the domain arrives" section, add
  a "Turn on search" step list: (1) set SEO_INDEXING_ENABLED=true in Vercel +
  redeploy; (2) add a host-based 308 in next.config.ts `redirects()` from the
  vercel.app host to the new domain — include the exact snippet using
  `has: [{ type: 'host', value: 'resale-platform-eta.vercel.app' }]`,
  destination the new origin with `:path*`; (3) Google Search Console: verify
  domain property, submit /sitemap.xml; (4) run Google Rich Results Test on one
  live listing URL and fix anything flagged; (5) note: Google Merchant Center
  free listings (one-of-a-kind used apparel ⇒ identifier_exists=false) is the
  follow-on lever once (1)–(4) are done.

## TASK 9 — Tests (match existing unit + e2e house patterns)

Unit (vitest, alongside the ~existing suite):
- schemaCondition boundaries (10, 9, 1); schemaImages drops falsy AND index 5;
  metaDescription truncates ≤160 on word boundary, falls back when empty;
  centsToPrice; JsonLd escaping: a title containing `</script><script>` must
  serialize with no raw `<` in the output.

E2E (non-@live, guest context, seeded fixture listing):
- /robots.txt → 200, contains 'Disallow: /api/'.
- /sitemap.xml → 200, contains '/listings/'.
- listing page: exactly the JSON-LD scripts expected; parse the Product block —
  @type Product, offers.priceCurrency 'USD', offers.price matches the fixture,
  image array non-empty and possession URL absent.
- /browse: `<link rel="canonical">` ends with '/browse'.

## VERIFY / GATES
- `pnpm verify` GREEN natively (baseline 392 tests + the new ones; runs on the
  Mac, not the cloud bridge).
- `pnpm build` (dev server stopped — see RUN CONTEXT): route table must show
  sitemap.xml, robots.txt, manifest.webmanifest, icon, apple-icon.
- Grep gate: no remaining hardcoded 'Resale Platform' outside lib/seo.ts
  (styleguide copy exempt if any), no possession_photo/images[5] reachable from
  any schema/OG path.
- Files this prompt may touch: lib/seo.ts (new), lib/seo-listing.ts (new),
  lib/flags.ts, app/layout.tsx, app/icon.svg (new), app/apple-icon.tsx (new),
  app/manifest.ts (new), app/sitemap.ts (new), app/robots.ts (new),
  app/components/json-ld.tsx (new), app/listings/[id]/{page.tsx,get-listing.ts},
  app/browse/page.tsx, app/sellers/[username]/page.tsx, app/enter/page.tsx,
  static/admin pages' metadata exports, .env.example, docs/LAUNCH_RUNBOOK.md,
  tests. NOTHING ELSE — no middleware.ts, no migrations, no app/api/**, no
  checkout/fees/stripe files. If you believe another file must change, STOP and
  write the reason into the commit message body instead of doing it.

## NON-GOALS (explicitly deferred)
- SEO2 (with HF7): public SOLD archive — anon-read RLS migration (db-guard) +
  sold placard state + availability SoldOut + similar-live-listings module +
  per-listing dynamic OG image route (next/og card). ALSO: HF7's new
  IndexTable/SearchOverlay must keep real `<a href>` anchors — that requirement
  lives in the HF7 prompt, not here.
- Merchant Center feed/onboarding (post-domain, human step).
- No new dependencies of any kind (no next-sitemap, no schema-dts).
