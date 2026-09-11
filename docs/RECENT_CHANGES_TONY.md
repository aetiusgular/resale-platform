# Recent changes (Tony), 2026-09-10 22:00 to 2026-09-11 08:30 UTC

Twelve commits on `main` plus one uncommitted change, all UI, accessibility, and
repo guardrails. No `lib/`, `app/api/`, or database changes. Every stylesheet
change was measured in Chromium at 1440, 960, 720, 390 and 320px before it was
applied; `tsc` was clean after every step. ESLint and `next build` were not run
inside the cloud session and should be confirmed with `pnpm verify && pnpm build`.

Commits, newest first:

| Hash | Time (UTC) | Subject |
|---|---|---|
| uncommitted | 08:30 | SYSTEM theme option in the account popout; drop the settings appearance section |
| `5932dde` | 08:22 | ui(settings): theme toggle draws 32px squares inside 44px targets |
| `ba89024` | 08:01 | ui: product page and legit-check cleanup, persistent header, sort dropdown, settings copy |
| `3e50491` | 06:11 | a11y: WCAG AAA contrast and 44px targets; 11px type floor for nav and product page |
| `b52e036` | 05:09 | chore(guardrails): correct README design system, wire CONTRIBUTING.md, pin pnpm 11.26.0 |
| `6c0232e` | 05:01 | docs: add CONTRIBUTING.md playbook for contributors and coding agents |
| `0dbeb27` | 04:30 | ui(browse): fix SORT label change shifting the filter controls |
| `fb5aea6` | 04:19 | ui(legit-check): add flag icon to count strip and vote controls |
| `2d451b4` | 03:25 | ui(footer): standard Instagram/TikTok icons; drop escrow line |
| `29baafd` | 03:25 | a11y: dark-mode contrast, input focus, nav labels, target sizes, listing main landmark |
| `7f69df5` | 2026-09-10 22:37 | ui(browse): show FILTERS / SORT dock at the 960px breakpoint |
| `daec7d9` | 2026-09-10 22:13 | ui(auth): remove default SIGN IN TO CONTINUE modal heading |
| `9af499d` | 2026-09-10 22:13 | ui(listing): gallery-under layout, viewport-fit 3:4 image, mobile listing to 960px |

---

## 1. Listing page

**Layout (`9af499d`).** Desktop gallery moved under the image column (R2B "gallery
under"). The stage is a 3:4 frame that fits the viewport height, capped at 600px tall,
and never exceeds the column minus the arrows. The middle breakpoint was removed; the
mobile listing layout now runs up to 960px. The escrow line and the price on the mobile
BUY NOW dock button are gone.

**Carousel (`ba89024`).** The stage and the thumbnail strip share one width variable
(`--pdp-stage-w` on `.pdp__left`), so the thumbnails align exactly to the main image
edges. Measured equal at 1440, 1280 and 1024.

**CTAs (`3e50491`, `ba89024`).** BUY NOW, MAKE OFFER and MESSAGE SELLER are 52px tall
with 13px labels on desktop and in the mobile dock. All three base button classes
(`.btn-primary`, `.btn-ink`, `.btn-ghost`) sit on `min-height: var(--control-h)` with
flex centring; `--control-h` is 44px and is now actually used.

**Details (`ba89024`).** Back arrow is Phosphor `ArrowLeft` in both the desktop crumb and
the mobile BACK TO RESULTS. "· 0 SAVED" removed from the LISTED line (split in the page,
`lib/` untouched). Condition removed from the description header and the mobile spec
row; the sell form's condition input stays because the listings API requires it.
Middots in the crumb, shipping line, spec rows and seller trust line replaced by the
`.sep` hairline.

**Type (`3e50491`).** Crumb, image counter, thumbnail captions, measurements title,
LISTED line, legit link and chip, size, shipping, description labels, spec keys and
values, seller meta and mobile seller handle/message all raised to 11px; mobile brand
name to 12px; seller initials badge to 10px.

## 2. Legit check

**Icons (`fb5aea6`, `ba89024`).** Wavy flag icon (S-curve) next to FLAG in the strip,
the vote bar and per-comment FLAG. Check icon next to LEGIT in the strip, the vote
button and per-comment AGREE, same placement pattern.

**Strip (`ba89024`).** Now reads `[check] n LEGIT   [flag] n FLAGGED` only. The dot, the
"LEGIT CHECK —" prefix and the AUTO-AUTH / MOD VERDICT line are gone.

**Copy (`ba89024`).** "ONE VOTE PER MEMBER PER LISTING · MODERATORS SIGN THE VERDICT"
removed; the thread-closed and verify-your-ID messages still show when they apply.
"NO LEGIT CHECKS YET — BE THE FIRST TO WEIGH IN." removed. Per-comment actions use
hairline separators; the "LC · LEGIT" tag is "LC LEGIT".

## 3. Header, navigation, popout, theme

**Persistent header (`ba89024`).** `SiteHeader` renders once in `app/layout.tsx` through
a client `ShellSwitch` and survives client navigations; only the page below it
skeleton-loads. `AppShell` still wraps every page but renders content plus footer. All
11 `loading.tsx` skeletons dropped their ghost header. Auth, onboarding,
reset-password and banned routes stay bare. The search field mirrors the URL query on
`/browse` and is empty elsewhere.

**Targets (`3e50491`, `5932dde`).** Nav links are 44×44 boxes; the search field,
avatar, SIGN IN and wordmark keep their exact visual size and gain invisible 44px hit
areas. Mobile actions gap tightened to 5px so four targets fit at 320px. Glyphs are
20px wherever the nav is icon-only (960px and below).

**Popout (`ba89024`, uncommitted).** Phosphor `Bell`, `Package`, `GearSix` next to
Notifications, Orders, Settings. Theme toggle is icon-only (`Sun` / `Moon` / `Monitor`)
with `aria-label` and `title`, and now offers LIGHT / DARK / SYSTEM.

**Theme toggle squares (`5932dde`).** Each option is an invisible 44×44 target with a
32px bordered square drawn inside it, the avatar's footprint; the selected one is
filled ink. Options no longer form a joined strip, which keeps the targets from
overlapping.

**Type (`3e50491`, `ba89024`).** Nav labels 11px, SIGN IN 11px, avatar initials 11px,
ALPHA badge and count badges 10px, search placeholder and input 14px.

## 4. Browse

- `7f69df5`: FILTERS / SORT dock shown at the 960px breakpoint, where the rail is hidden.
- `0dbeb27`: SORT button has a fixed 125px min-width so cycling the label never
  shifts MY SIZES / EDIT SIZES / SAVE SEARCH.
- `ba89024`: SORT is a listbox dropdown (Phosphor caret, 44px rows, checkbox marks the
  current sort, Escape and click-outside close it). The old cycle handler is gone; the
  mobile bottom sheet is unchanged. A dead legacy `.sort-menu` CSS block that would have
  put the menu under the click-outside overlay was removed. Rail divider removed.
  Category squares fill `--line` on row hover. Card hover darkens the image
  (`brightness(.85)`) and dims brand, title and price to 70% together. Dock labels use
  hairlines; the chip path separator is `/`. Mobile results count 28px → 20px.

## 5. Footer, auth, settings

- `2d451b4`: standard Instagram and TikTok icons; escrow line removed from the footer.
- `daec7d9`: default SIGN IN TO CONTINUE modal heading removed.
- `ba89024`: footer `© 2026 ARCHIVE / US ONLY — OPEN ALPHA` line removed (the wordmark
  and ALPHA badge above it carry that). "SELLING NEEDS AN ACCOUNT" removed from the auth
  modal. Settings: "USERNAME CAN CHANGE 1× / 30 DAYS" shows only when the API refuses a
  second change inside 30 days (`409 username_window`), in the same spot, styled as an
  error. "Applies to this device.", "ARRIVES AT LAUNCH" and the "Shown on your profile"
  placeholder removed.
- Uncommitted: "04 — APPEARANCE" section removed from the settings hub (theme lives in
  the popout).

## 6. Accessibility

**AA pass (`29baafd`).** Dark `--faint` 2.77:1 → 4.56:1; light and dark `--line-mid` to
3:1+; placeholder opacity 0.4 → 0.6; focus rings on borderless inputs; 24px targets on
the legit link and caption save; `.lc-input` border to `--line-mid`; nav labels hidden
with an sr-only pattern instead of `display: none`; listing page wrapped in `<main>`.

**AAA pass (`3e50491`).** Every text token clears 7:1 in both themes: light `--faint`
#53534e, light `--alert` #952e26, dark `--sub` #b0b0ab, dark `--faint` #a0a09b, dark
`--alert` #de8981; placeholder opacity 0.75. Every header control and the three control
buttons are at least 44×44. Type floor: 11px for anything read or operated, 10px for
count badges and tag chips, applied to the nav and product page. Remaining AA checks
(reflow at 320px, text spacing, zoom) verified passing.

**Icons (`ba89024`).** All 14 custom outline icons unified to a 1.5 stroke with round
caps, matching the flag and Phosphor regular. New icons come from
`@phosphor-icons/react/ssr`.

## 7. Guardrails, docs, tooling

- `6c0232e`: `CONTRIBUTING.md` (337 lines): setup, the verification gate mapped to CI,
  repo zones, the feature loop, Playwright spec template, design system, PR checklist.
- `b52e036`: README design-system section rewritten to the real ARCHIVE system (it
  described the previous Inter / EB Garamond / `--color-*` / 44px system); Playwright
  browser install added to Getting started; `AGENTS.md` points to CONTRIBUTING and adds
  it to the protected list; `package.json` pins `pnpm@11.26.0`; `ci.yml` drops
  `version: 11` from the three `pnpm/action-setup` steps (the action errors when both
  are set).
- `3e50491`, `ba89024`: rulebooks updated for 44px controls, AAA text contrast, the
  11px type floor, and the icon system.

## 8. Tests

- `ba89024`: `browse.spec.ts` gained two structural specs for the sort dropdown (pick
  PRICE ↑ sets `?sort=price_asc`; Escape closes without changing the sort).
  `mobile.spec.ts` now asserts `SORT` and `NEWEST` separately, since the dock label no
  longer contains a middot.

## 9. Open items

- Branch protection on `main` is still not enforced. Private repos need GitHub Pro for
  rulesets; until then CI and the protected-paths guard are advisory. Also confirm
  "Run workflows from fork pull requests" under Settings → Actions.
- About 200 middots remain outside the product page, legit check and browse dock
  (settings, saved, messages, notifications, sell). Same `.sep` treatment applies.
- 147 declarations at 9px or under remain outside the nav and product page, plus 40 at
  10px including the browse dock.
- Controls outside the header still under 44px: `.btn-outline`, inputs, `.btn-mini`,
  `.link-btn`, chips, the vote-bar buttons, per-comment actions.
- The mobile settings menu still has its own LIGHT / DARK theme row with no SYSTEM.
- The legit-check comment input narrows to 74px at 320px after the button text grew;
  `flex-wrap: wrap` on `.lc-form` at 720px and below would drop the buttons under it.
- `design-reference/tokens/` still holds the previous palette; an agent scanning the
  repo can pick it up as "the tokens".
- Stored image files are not normalised to 3:4; every display frame is, and the
  sell-form preview now matches. Normalising at upload is a `lib/` change.
