# Secondhand marketplace UI — catalog identity research

**Date:** 2026-09-07 (second recast same day)  
**Goal:** Give ARCHIVE a catalog identity that is more than “Grailed with our tokens” — a serious archive, not street-hype and not Depop chaos — without touching checkout, auth, or money.  
**Method:** Live site visits (Playwright + existing captures). Farfetch / Selfridges catalog grids via Mobbin. Screenshots in `research-screenshots/`.  
**Product context:** `/` currently redirects to `/browse`. Light default, hairlines, radius 0, Archivo + IBM Plex Mono, light default. Identity work is **catalog skins**, not a new homepage.

**Founder decision (2026-09-07):** Homepage-as-index is parked. Explorations must stay on the **browse/catalog page** — same IA as ARCHIVE today (header, department/category rail, results + sort, 3–4 col 3:4 cards with brand / size+save / title / price). Each variation is its **own design system**, not a recolor.

**Founder decision (2026-09-07, later):** The first four catalog boards (iron archive / folio serif / newsprint / atelier cloth) failed. Same beige-editorial family, tone-block cards, intern-portfolio tropes (rust hairline, cream+oxblood ledger, yellow sticker, linen+ochre). Do not restyle those. Redo.

**Paper file:** https://app.paper.design/file/01M1YYKQ1S54QTSYK72WP95BHR — still the target file. Paper web asked to sign in (`Welcome to Paper! Create an account to edit`). Inkbox MCP auth timed out. Paper Desktop was opened. Boards were redrawn as local catalog HTML (never imported by app code) and exported as PNGs.

**Drawn now — four different worlds, same eight lots, real garment photos:**

| Artboard | Identity claim |
|----------|----------------|
| `Catalog · Cut` | ARCHIVE, sharpened. True white, ink-only accent, Archivo + Plex Mono, photography does the selling. No rust. |
| `Catalog · Noir` | Cold luxury black. Bodoni Moda mark, Host Grotesk facts (no mono prices), white as the only signal. |
| `Catalog · Lot` | Street-archive clarity. Schibsted Grotesk + Azeret Mono, boxed SEARCH, cobalt `#1557FF` on selected + under-24h times only. |
| `Catalog · Vitrine` | Ice museum wall. Gloock mark/brands, Onest chrome, Klein `#002FA7` as a filled selected row. Not paper. |

**Source of truth:** `design-reference/homepage-explorations/catalog-boards.html`  
**Previews:** `research-screenshots/paper-cut.png`, `paper-noir.png`, `paper-lot.png`, `paper-vitrine.png`  
**Killed:** `paper-iron-archive.png`, `paper-folio-serif.png`, `paper-newsprint.png`, `paper-atelier-cloth.png` plus the rust / oxblood / yellow-sticker / ochre systems they represented.

Same eight lots on every board: Acne parka, Margiela leather, A.P.C. chino, Ferragamo tote, Auralee knit, Crockett derby, Our Legacy bomber, Porter pack.

---

## Sources actually opened

| Site | URL opened | Screenshot | Notes |
|------|------------|------------|--------|
| Grailed | https://www.grailed.com/ | `research-screenshots/grailed-homepage.png` | Live homepage. Catalog-first. |
| Depop | https://www.depop.com/ | `research-screenshots/depop-homepage.png` | Live homepage. Cookie wall + editorial hero. |
| Vinted | https://www.vinted.com/ | `research-screenshots/vinted-homepage.png` | Live homepage. Short hero then catalog. |
| The RealReal | https://www.therealreal.com/ | `research-screenshots/therealreal-homepage.png` | Live homepage. Campaign hero. |
| Vestiaire Collective | https://www.vestiairecollective.com/ → https://us.vestiairecollective.com/ | `research-screenshots/vestiaire-homepage.png` | Live homepage (cookie overlay). Prior aborted run hit Cloudflare; this visit rendered. |
| Poshmark | https://poshmark.com/ (aborted-run capture) | `research-screenshots/poshmark-homepage.png`, `poshmark-browse.png` | Reused from aborted session 35c543a2. Live homepage + Women’s hub. |
| eBay Fashion | https://www.ebay.com/b/Fashion/1/bn_7000259856 → https://www.ebay.com/b/Clothing-Shoes-Accessories/11450/bn_1852545 | `research-screenshots/ebay-fashion.png` | Fashion hub redirected to Clothing, Shoes & Accessories. |
| StockX | https://www.stockx.com/ → https://stockx.com/ | `research-screenshots/stockx-homepage.png` | Live homepage. Search + data catalog. |
| SSENSE | https://www.ssense.com/ | `research-screenshots/ssense-homepage.png` | Editorial identity only (not peer-to-peer). |
| ARCHIVE today | http://localhost:3100/browse | `research-screenshots/archive-browse.png` | Live after compile. First hit 404’d; page then rendered. `/` → `/browse`. Proto PDP also seen at a Vercel preview (`/styleguide/proto/proto-01`). |

Aborted-run leftovers **not** reused as evidence: `vestiaire-homepage.png` / `vestiaire-browse.png` (Cloudflare “Verify you are human”). Those files were overwritten with the live Vestiaire homepage on this visit.

---

## Competitive matrix

| Site | Homepage IA | Accent / type / density | Identity vs generic grid | Steal | Avoid | Why |
|------|-------------|-------------------------|--------------------------|-------|-------|-----|
| **Grailed** | Catalog-first. Sticky header: wordmark · dept/designer/shop/sell · search · login. No editorial hero. Immediate 4-col feed. Teal promo strip (“Staff Picks”). | Near-black/white + **teal** (`#00c2a8`-family) on promo + login. Neutral sans. High density, hairlines, sharp-ish cards. | Identity = search + feed + one loud promo. Brand lives in chrome, not in page rhythm. | Search as a first-class tool. Data-dense cards. | Teal promo bar. Dumping the visitor into a 4-col grid as the *homepage*. Hearts on every card. | ARCHIVE already *is* this skeleton. Copying it again cannot produce identity. |
| **Depop** | Social / editorial. Full-bleed lifestyle hero, “Shop now”, circular category chips (Y2K, Vintage, Streetwear…). Cookie-first. | **Red** wordmark + CTAs. Rounded everything. Soft gray ground. Mid density, photography-led. | Identity = community / trend culture. Grid is secondary to mood. | Photography can carry a front page. | Rounded social chrome, red retail CTAs, trend-chip carnival, cookie-as-hero. | Reads as a youth social product. ARCHIVE is an archive, not a hangout. |
| **Vinted** | Soft hero (“Ready to declutter your wardrobe?”) then category icon row + “Shop by items” 5-col grid. | **Teal** wordmark + Sell button. Friendly sans. High density, rounded cards, circular category glyphs. | Identity = helpful utility. Almost no editorial point of view. | Brief welcome, then catalog. Buyer Protection as a trust line (not a design motif). | Circular icon taxonomy. Mass-market “declutter” voice. Generic card chrome. | Functionally close to a classifieds site. No reason for ARCHIVE to sound helpful-generic. |
| **The RealReal** | Luxury retail. Full-bleed campaign hero (“Spring 2026”) over product still-life. Mega-nav departments. Authenticate / Consign in chrome. | Teal-green wordmark + promo. Serif-leaning mark, retail sans. Low–mid density above the fold. | Identity = in-house campaign photography. Looks like a department store, not a peer market. | A designed *front* before the grid. Trust language in chrome, not as badges on every card. | Campaign-retail pastiche, seasonal lookbook energy, consignment-house voice. | ARCHIVE does not consign or shoot campaigns. Borrowing this look would be costume. |
| **Vestiaire** | Luxury editorial. Campaign hero (“Fall-Winter 2026”), “Shop the edit”, Women/Men/Kids + Authenticity in nav. | Black/white + **gold** “New here?” chip. Serif + sans. Low density until the cookie wall. | Identity = seasonal edit + authenticity claim. Closest luxury peer to RealReal. | One restrained metal accent. Authenticity as a *nav fact*, not a rainbow badge. | Gold-luxury cliché if we also copy the campaign hero. Cookie/GDPR as first paint. | Gold + campaign = “European luxury reseller.” We want archive, not maison. |
| **Poshmark** | Modular social-retail. Brands rail + editorial story carousel + Suggested for You + Posh Shows + Today’s Trends. Browse hub adds a category banner + 4-col grid + dense left rail. | **Burgundy** wordmark / Sell. Clean sans. High modular density. Rounded cards, light shadows. | Identity = community + live selling + brand logos. Grid is one module among many. | Brand index as credibility (a *designed* block, not a filter list). Modular IA — home can have more than one rhythm. | Posh Shows, live-viewer chrome, shadows, burgundy-as-button-color, marketplace clutter. | Modules are useful; their *contents* are social-commerce. Do not import the show. |
| **eBay Fashion** | Department hub. Promo tiles (Up to 60% off, Refurbished Week) + category photo tiles (Women, Men, Kids, Specialty). | eBay **blue** + multi-color promo. Generic retail sans. Mid density, rounded tiles. | Almost no fashion identity. A category directory with ads. | Department as a way *into* catalog (the idea, not the tiles). | Promo rainbow, % off language, marketplace carnival, blue brand. | This is what “no point of view” looks like. |
| **StockX** | Search-first catalog. “Search for…”, trending queries, 6-col product grid, Buy / Bid data on every card. | **Green** wordmark + Buy. Tight sans. Very high data density. | Identity = price as a market. The grid *is* the brand. | Treat price / size / time as typographic objects (we already do this with mono). | Hype-green, trading-card energy, Bid/Ask as homepage chrome, 6-col crush. | StockX is an exchange. ARCHIVE is a catalog of garments. Steal the data seriousness, not the ticker. |
| **SSENSE** (editorial only) | Full-bleed fashion film / still. Minimal chrome: SSENSE · search · account · bag. No grid above the fold. | Ink-only. No accent. Magazine restraint. | Identity = image + wordmark. The store is behind the picture. | Restraint. Type + photography can be enough. A front that is *not* a grid. | Hiding commerce entirely. Fashion-magazine costume. Full-bleed video as a product home. | SSENSE is a retailer with an editorial arm. We can take the *quiet*, not the media house. |

---

## ARCHIVE today vs Grailed overlap

Observed on `http://localhost:3100/browse` (effective homepage):

| Layer | ARCHIVE now | Grailed now | Overlap |
|-------|-------------|-------------|---------|
| Entry | `/` → `/browse`. No home. | Homepage *is* the feed. | **Same IA.** Visitor lands in a catalog. |
| Chrome | `ARCHIVE` wordmark · search · SELL / SAVED / MESSAGES · avatar. Hairline under header. | Wordmark · dept/designer links · search · Sell / Shop / Login. | Search-centric header, catalog chrome. |
| Page | Left filter rail (Department / Category / Size / Designer / Color / Price / Show only) + 4-col grid. | No rail on home; filters live in browse/search. Feed starts immediately. | 4-col product grid as the first story. |
| Type | Archivo chrome, **IBM Plex Mono for all listing data**. | Neutral sans; prices not as strictly “data.” | We are *more* mono than Grailed — which currently reads as “Grailed, but colder.” |
| Color | Ink / warm gray / hairlines. **No accent.** `--color-accent` aliases to `--ink`. | Ink + **teal promo**. | We subtracted their only identity move and did not replace it. |
| Geometry | Radius 0, 1px rules, no shadow. | Near-sharp cards, light rules. | Same family. |
| Card | Image · brand · size · bookmark · title · `$n · nD AGO`. | Image · heart · brand/title · price. | Same information order. |

**Why it clones:** identity is currently *system tokens applied to a Grailed page type* (catalog-as-home). Removing teal without adding a different front, a different rhythm, or a considered accent leaves a blank Grailed.

The older Paper file `market` (`https://app.paper.design/file/01M1HWFGHZG5NPFM2X3QN0GZH7`) is browse rails / cards / PDP in an earlier token set. Catalog identity variants live in the file linked at the top of this doc.

---

## Identity thesis

ARCHIVE is a **serious archive of garments**, not a street-hype feed and not a social flea market. Identity lives on the **catalog page** — type pairing, color, control language, card chrome, density, and what the accent is allowed to touch — not on a magazine front. Each Paper board keeps the browse IA and changes the system. Accent never fills Buy / Offer / Sell. Prices stay integer cents via existing helpers if any system ships.

---

## Homepage layout directions — parked

Founder rejected homepage-as-index (2026-09-07). The three named fronts below are historical; do not draw them as the experiment. Ledger Front’s *spirit* (catalog-first, identity from system) is what the catalog boards now do.

### 1. Issue Index — parked

1. Masthead: `ARCHIVE` · issue line in mono (`VOL. 01 · US`) · search · SELL / SAVED / MESSAGES.  
2. One held piece (large still, not a model campaign) + a typed caption (brand · title · size · price).  
3. A three-up “from the racks” row.  
4. Department index as text, not circular icons (`MENSWEAR`, `WOMENSWEAR`, `OBJECTS`).  
5. Then the familiar catalog grid — so `/browse` remains the engine, not a second product.

**Why:** SSENSE taught that a front can be quiet; Poshmark taught that home can have more than one module; Grailed taught that skipping the front is how you disappear. This is editorial *enough* to not be Grailed, catalog *enough* to not be a magazine.

### 2. Department Stage — parked

No hero garment. The first surface is four large department plates (Menswear / Womenswear / Objects / Designers) as hairline fields with mono counts. Search sits in the masthead. Catalog appears only after a plate — or as a short “just in” strip under the plates.

**Why:** eBay’s department tiles work as *wayfinding* when stripped of promo. This is catalog-forward without Grailed’s immediate 4-col dump. Use if the founder rejects any editorial image on `/`.

### 3. Ledger Front — parked (spirit kept: catalog-first)

Catalog-first, but the page opens on a typed ledger band: date, lot count, “just in,” a single iron rule — then the 4-col grid. No photography stage. Closest to today’s `/browse`, farthest from a new identity.

**Why:** If we must stay catalog-first, identity has to come from *index typography*, not from another grid tweak. Still more ARCHIVE than Grailed teal. Draw this only if Issue Index and Department Stage both fail a review.

---

## Accent directions (proposed tokens)

Do not add these to `app/globals.css` until a direction is chosen. Names are proposals.

### A. `--accent-iron` — **recommended**

- Light: `#8A3D2F`  
- Dark: `#C47866`  
- Use: 1px rules on the masthead / issue line, wordmark hairline, “just in” marker. **Never** fill Buy / Offer / Sell.  
- Why: archival, warm, not Grailed teal, not Depop red, not StockX green, not Vestiaire gilt. Reads as rust / binder / old ink, not as a CTA.

### B. `--accent-folio` — cold alternative

- Light: `#2C3A4A`  
- Dark: `#8A9BB0`  
- Use: same rule-only discipline.  
- Why: carbon / folio ink. Safer, easier to confuse with `--sub`. Choose if iron feels too close to `--alert` (`#b3382f`).

### C. Ink-only (no new token)

- Keep `--color-accent` → `--ink`.  
- Identity then *must* come from layout + type size contrast (Issue Index still works; Ledger Front becomes the honest catalog-first version).  
- Why: most on-brand with today’s system. Weakest differentiation from “blank Grailed.” Rejected as the *drawn* pair because the founder asked for more variation than Grailed and the current ink-only home is exactly that clone.

**Not proposed:** Grailed teal, Depop red, StockX green, Vestiaire gold-as-fill, Poshmark burgundy-as-button, any purple.

`--alert` stays disputes / errors only.

---

## Practices to implement

| Practice | Why (design-engineering) |
|----------|--------------------------|
| Keep Archivo / IBM Plex Mono split | Voice vs data. StockX proves price-as-data is identity; we already have the better type pairing. |
| Keep radius 0, 1px hairlines, no shadow / gradient | The system is the motif. Flair = type + one rule color, not decoration. |
| Differentiate on the catalog, not a new home IA | Founder: same layout as browse; identity is the design system. |
| One accent, rule-only | Vestiaire’s gold chip works because it is scarce. Filling buttons would fight `--ink` CTAs and leak into checkout. |
| Department as typed index, not icon row | Vinted/eBay icons are taxonomy decoration. Text departments match our rail language. |
| Brand / designer index as a designed block | Poshmark’s logo rail is credibility. We can do it as a mono list, not a logo quilt. |
| Trust in chrome, not on every card | RealReal / Vestiaire put Authenticate in the nav. Card-level badge stacks are Grailed/StockX noise. |
| Per-system accent rules written on the board | Comparison is about what the accent may touch, not a new page type. |

## Practices to reject

| Practice | Why |
|----------|-----|
| Catalog-as-home with a colored promo strip | That *is* Grailed. |
| Depop / Poshmark social chrome (rounds, lives, trend chips) | Wrong product category. |
| RealReal / Vestiaire campaign-retail hero | We do not consign or shoot seasons. Costume. |
| eBay promo tiles and % off | No point of view; trains people to hunt discounts. |
| StockX Bid/Ask and hype green | Exchange, not archive. |
| Shadows, gradients, promo fills | Forbidden by the live system. Paper may try radius 2 (atelier) as a *system* choice, not elevation. |
| Accent on money actions | Checkout / offer / fees stay ink. Accent is institutional, not commercial. |
| Re-implementing fee / trust / auth in the home | Out of scope. Home does not invent commerce. |
| Rainbow or “AI purple” | Unconsidered accent. |

---

## Paper.design experiment brief

**File (recast 2026-09-07):** [ARCHIVE homepage identity](https://app.paper.design/file/01M1YYKQ1S54QTSYK72WP95BHR) — filename leftover; contents are catalog skins.  
Do not add these frames to the existing `market` browse/PDP file.

**Drawn now (replaced iron / folio / newsprint / atelier):** four 1720×1080 catalog boards, shared IA + shared eight lots + real garment photography, small notes column on each.

1. **Catalog · Cut** — sharper ARCHIVE (ink only, no rust).  
2. **Catalog · Noir** — cold luxury black.  
3. **Catalog · Lot** — street-archive clarity (cobalt, not teal).  
4. **Catalog · Vitrine** — ice museum (Klein, not beige).

Do **not** draw checkout, auth, or fee math. Cards use the same merch photographs on every board.

**Open questions left for the founder**

1. Which catalog system (if any) should become the next ARCHIVE token pass?  
2. Should Cut stay the closest ship candidate (least new type, most photography craft)?

**Localhost catalog:** `http://localhost:3100/browse` was live on this pass. Layout still matches `app/browse/browse-client.tsx`, `app/components/listing-card.tsx`, and `app/globals.css`. Paper web is unsigned-in; open the HTML locally or the PNGs if Desktop does not show the new boards.

---

## What this file reused from the aborted run (35c543a2)

- Confirmed: no research file, no `design-reference/homepage-explorations/`, no homepage Paper/MagicPath frames.  
- Reused: Poshmark homepage + Women’s browse screenshots (live captures).  
- Discarded: Vestiaire Cloudflare walls.  
- Continued: same source list, same ARCHIVE-vs-Grailed question, same constraint (research before drawing; no app home implementation).
