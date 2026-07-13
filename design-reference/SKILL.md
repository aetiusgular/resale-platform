---
name: provenance-design
description: Use this skill to generate well-branded interfaces and assets for Provenance (placeholder name — curated, invite-only secondhand designer fashion marketplace), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Hard rules that make this brand:
- Six color tokens only (--bg --ink --ink-soft --line --accent --alert). Accent
  (#1B4332) is budgeted: verified/authenticated marks, active states, success —
  max one accent element per view. Alert (#B3261E) = errors/disputes only.
- Three fonts: Inter (UI chrome), EB Garamond (ONE serif moment per screen),
  Space Mono (ALL listing data — titles, prices, sizes, condition scores,
  timestamps, usernames). Type scale 12/14/16/20/28/40.
- 1px --line borders only; 2px max radius; only shadow is 0 1px 2px rgba(0,0,0,.06);
  white backgrounds everywhere; no gradients, icons, illustrations, or emoji.
  Typographic glyphs (× ▾ → · —) do icon work.
- 8px grid, 1280px max width, 24px gutters, ≥64px between sections.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets
out and create static HTML files for the user to view. If working on production code,
copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to
build or design, ask some questions, and act as an expert designer who outputs HTML
artifacts _or_ production code, depending on the need.
