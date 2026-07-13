# ROADMAP.md
## Build milestones — B0 through B8

- [x] **B0** — Bootstrap: Next.js 15, Tailwind, design tokens, CLAUDE.md, agents, harness, Supabase migration, CI
- [x] **B1** — Auth + invite gate (M1): Supabase email auth, invite_codes table, onboarding flow
- [x] **B2** — Listings + curation queue (M2): listings schema, image upload, 4-step sell flow, admin queue, listing detail
- [x] **B3** — Anti-slop layer (M3): perceptual hashing, brand-stuffing lint, possession-photo enforcement, velocity limits
- [x] **B4** — Browse + search (M4): filter rail, full-text search, pagination, favorites, price-drop badges, PostHog
- [x] **B5** — Checkout + escrow + seller protection (M5 + M5b): Stripe Connect, order state machine, dispute flow, pg_cron
- [x] **B6** — Chat + offers (M6): Realtime messaging, offer state machine, link blocking, accepted offer → checkout
- [x] **B7** — Community layer (M7): comments with RLS, LC thread, agree/flag, verified_checker gate, admin moderation, seller toggle
- [ ] **B8** — Analytics, hardening, alpha polish (M8): PostHog dashboards, Sentry, rate limiting, security review, seed script, LAUNCH.md
