# Provenance — Design System

> **"Provenance" is a placeholder wordmark.** No brand name or logo was supplied.
> Wherever a mark would go, the name is set in plain type (Inter 600, ALL CAPS,
> +0.08em). Never draw a logo. Replace the name project-wide when the real one exists.

## What this is

The foundational design system for a **curated, invite-only peer-to-peer marketplace
for secondhand designer fashion and streetwear** (the category Grailed occupies, with
our own identity). Audience: 18–35 fashion resellers and collectors.

**Personality: archival, precise, quiet confidence. A gallery, not a bazaar.**

Source of truth: the written brand spec provided in the brief. No Figma, codebase,
logo, or photography was supplied — flagged throughout where it matters.

Desktop-first at 1440px; responsive down to 375px. Max content width 1280px.

## Content fundamentals

The system speaks like a **registrar cataloguing objects**, not a store selling them.

- Sentence case in all UI chrome. ALL CAPS only for nav items and section labels
  (11–12px, +0.08em tracking).
- No exclamation points. No emoji. No urgency tropes ("Hurry!", "Only 2 left!").
- Buttons are 1–2 word verbs, sentence case: "Make offer", "List item", "Save".
- Listing data is factual and abbreviated, always mono: `Raf Simons`, `AW03`,
  `8/10`, `EU 48`, `@objectdealer`, `3d ago`.
- The system states facts; it does not celebrate itself.
  - Yes: "Authenticated. Certificate added to the listing."
  - No: "Woohoo! Your item was successfully authenticated! 🎉"
- Empty states are calm: "Nothing in the archive yet."
- Errors are exact and reassuring: "Payment declined. No funds were taken."
- Membership copy is quiet, not exclusive-smug: "Membership is by referral."
- Address the user as "you" sparingly; prefer neutral catalog statements.

## Visual foundations

**Color** — six tokens, nothing else (`tokens/colors.css`): `--bg` #FFFFFF,
`--ink` #111111, `--ink-soft` #6B6B6B, `--line` #E5E5E5, `--accent` #1B4332,
`--alert` #B3261E. No gradients anywhere. No dark mode.

- **Accent budget:** `--accent` appears ONLY as verified badges, active states,
  "authenticated" tags, and success confirmations — **max one accent element per
  view.** When listing data itself carries VERIFIED tags, keep chrome accent-free.
- `--alert` is errors and dispute states only. Never decorative.

**Backgrounds** — always `--bg` white. No background images, textures, patterns,
tints, or section color-blocking. Structure comes from 1px `--line` rules and space.

**Borders** — 1px `--line`, always. Heavier weights and 2px+ borders don't exist.
Emphasis is achieved by swapping border color to `--ink` or `--accent`, never weight.

**Shadow** — one allowed value, `--shadow-1: 0 1px 2px rgba(0,0,0,0.06)`, used only
on floating surfaces (dropdown menu, toast, modal). Cards never have shadows.

**Corners** — 2px radius (`--radius`) on controls and surfaces; 0 on images. Nothing
rounder. "Pills" (tier badges) are 2px-radius rectangles by decree.

**Type** — Inter (UI, 400–700, -0.01em on 500–700), EB Garamond (one serif moment
per screen, 1.35–1.75rem, 400/italic), Space Mono (ALL listing data — the brand
signature). Scale 12/14/16/20/28/40. Body 14px Inter 400, line-height 1.6.

**Space** — 8px base grid (4px half-steps inside components). ≥64px between page
sections. 1280px max content width, 24px gutters. Whitespace is the luxury cue.

**Motion** — 120ms linear transitions on color, border-color, opacity, and the
input label float. Nothing else moves. No bounces, no scale, no parallax, no blur.

**Hover states** — quiet and typographic: `--ink-soft` text darkens to `--ink`;
hidden 1px borders appear (listing card); secondary buttons fill with ink; links'
underline darkens. Primary buttons ease to 90% opacity. Press: 80% opacity.

**Imagery** — product photography on white, 3:4, shot flat and even like an archive
record. No duotones, no overlays, no borders on real photos. None was supplied —
placeholder frames (1px `--line` box + mono "3 : 4" label) stand in. **Never
illustrate; never generate imagery.**

**Focus** — 1px `--ink` outline, 2px offset. Selection is ink-on-white inverted.

## Iconography

**There are no icons.** No icon font, no SVG glyphs, no emoji, ever. Where an
affordance needs a mark, use typographic glyphs from the loaded fonts:

- `×` dismiss / remove (U+00D7)
- `▾` / `▴` dropdown open/close (U+25BE / U+25B4)
- `→` follow-on links and actions (U+2192)
- `·` metadata separators (U+00B7)
- `—` em dash for ranges and registrar copy (U+2014)

If a case genuinely cannot be served by text, use text anyway.

## Components

Nine components, exactly as chartered — no additions. All controls are 44px tall,
2px radius. React, styled by the tokens.

| Component | Path | Notes |
| --- | --- | --- |
| Button | `components/actions/Button.jsx` | primary / secondary / text; `destructive` for dispute actions |
| Input | `components/forms/Input.jsx` | floating 12px caps label; `mono` for data fields |
| Dropdown | `components/forms/Dropdown.jsx` | input-shaped trigger; `▾/▴`; accent selected option |
| ListingCard | `components/listing/ListingCard.jsx` | 3:4 image; mono data; hover-only border; optional VERIFIED |
| TierBadge | `components/listing/TierBadge.jsx` | BRONZE→PLATINUM contrast ladder; Platinum = accent border |
| Tag | `components/listing/Tag.jsx` | filter chip; `authenticated` variant is the accent use |
| TabBar | `components/navigation/TabBar.jsx` | caps labels; active = accent text + 1px accent underline |
| Toast | `components/feedback/Toast.jsx` | white, 1px line, --shadow-1; caps mono status label |
| Modal | `components/feedback/Modal.jsx` | centered, 1px line; white veil overlay, no blur |

Spec interpretations (decided, documented):
- **"Pill" tier badge** — global 2px-radius cap wins; badges are 2px rectangles.
- **Accent budget vs. VERIFIED tags** — VERIFIED/AUTHENTICATED marks on listing
  data are semantic record marks; the one-accent-per-view budget governs *chrome*
  (one active tab OR one success toast, etc.). Keep total accent density low.
- **Modal overlay** — spec bans blur; veil is `rgba(255,255,255,0.85)` (--bg at
  85%), keeping the gallery white.
- **Tier ladder without metallics** — Bronze `--line`/`--ink-soft`, Silver
  `--line`/`--ink`, Gold `--ink`/`--ink`, Platinum `--accent` border/`--ink` text.
  Hierarchy by contrast, not color.

## Index

- `styles.css` — global entry; @imports everything below
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`
- `components/` — `actions/`, `forms/`, `listing/`, `navigation/`, `feedback/`
  (each: `Name.jsx` + `Name.d.ts` + `Name.prompt.md` + one specimen card)
- `guidelines/` — foundation specimen cards (Colors / Type / Spacing / Brand)
- `ui_kits/marketplace/` — browse screen composing the components (demonstration)
- `SKILL.md` — agent-facing usage guide

## Do not

Use color outside the six tokens · use icons where text works · add illustrations,
emoji, or decorative graphics · use shadows beyond `--shadow-1` · round corners
past 2px · introduce dark mode · invent components beyond the nine above.
