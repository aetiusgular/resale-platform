# FRONTEND_LIBS.md — icon / scroll / animation decisions (July 2026)

## Icons: Phosphor (@phosphor-icons/react) — use the THIN or LIGHT weight
Chosen over Lucide/Heroicons. Reason: Phosphor ships six weights (thin, light,
regular, bold, fill, duotone); the **thin/light** weights match the refined,
editorial charcoal-archive aesthetic — Lucide has one medium stroke that reads
more "app" than "fashion."
- Standard: `import { Bookmark, Plus, ChatCircle } from '@phosphor-icons/react'`
  with `weight="thin"` (or `"light"`), `size={20}`, color via `currentColor`.
- Migrate the hand-rolled inline SVGs (mobile tab bar, avatar menu, save
  bookmark) to Phosphor thin for consistency in the next UI build (HF6).
- Tree-shakeable — only imported icons ship.

## Scroll: Lenis installed, but DO NOT enable globally on browse
Installed (`lenis` 1.3.25) per request, but a strong recommendation:
- **Do not wrap the browse grid / shopping surfaces in Lenis smooth-scroll.**
  Momentum/eased scrolling adds perceived latency for users scanning a product
  grid fast (our reseller audience), and it can desync with the browse
  IntersectionObserver infinite-scroll sentinel and anchor jumps.
- Acceptable uses: a marketing/landing page or an editorial "lookbook" page
  where a slower, considered scroll is the point. Scope it there, not app-wide.
- Native scroll is the right default for the transactional flows.

## Animation: GSAP — SKIPPED (deliberate, per the "ignore if negative" clause)
Not installed. For a minimal, fast-scan resale marketplace, heavy animation is a
net negative: it slows perceived performance, pulls attention off the product,
and fights the "fast archive database" feel we designed for. The audience wants
speed and clarity, not motion.
- Micro-interactions we already have (CSS transitions on hover/focus, the 120ms
  fades, the save-toggle) are sufficient and cheap.
- Revisit ONLY if a specific moment genuinely needs it (e.g., a launch-drop
  countdown) — and even then prefer CSS/Framer-Motion-lite over full GSAP.
