# LAUNCH_SERVICES.md — third-party services for launch

Recommended vendor per function. Confirm current plans/pricing at signup — those move.
"Founder" = a human account/signup is required (not agent-buildable).

| Function | Recommended | Alternatives | Who signs up |
|---|---|---|---|
| App hosting | **Vercel** | Netlify, self-host | Founder |
| DB / Auth / Storage | **Supabase** (already) | — | Founder |
| Payments + escrow | **Stripe** Connect (already) | — | Founder (live keys HUMAN-ONLY) |
| Seller ID verification | **Persona** (Grailed uses it) | Stripe Identity (one-vendor), Veriff | Founder (account + API key) |
| Google login | **Google Cloud OAuth** creds | — | Founder |
| Phone (SMS OTP) | **Twilio** | MessageBird, Vonage | Founder (Supabase phone-auth provider) |
| Transactional email | **Resend** | Postmark, SES | Founder |
| Web push | **web-push (VAPID)** self-host | OneSignal | — (code) |
| Shipping labels + tracking | **EasyPost** or **Shippo** | — | Founder |
| recs-engine VM | **Hetzner Cloud** (value) / **Fly.io** (simplest) | DigitalOcean, Lightsail | Founder |
| Managed Redis (if split out) | **Upstash** | Redis Cloud | Founder |
| Managed Qdrant (if split out) | **Qdrant Cloud** | self-host | Founder |
| DNS / TLS / tunnel | **Cloudflare** (registrar + Tunnel) | Namecheap + Caddy | Founder |
| Error + product analytics | **Sentry** + **PostHog** (already) | — | Founder |

## recs-engine hosting (do later)
Easiest live setup: one **Hetzner or Fly** box running the full `docker compose`
(redis + qdrant + api + feed + 4 workers) with a **Cloudflare Tunnel** in front for
HTTPS — no separate managed Redis/Qdrant needed for testing. No GPU (stub encoder).
Full steps in `docs/recs-hosting.md`. Point the platform at it with matching
`RECS_INGEST_HMAC_SECRET` / `RECS_FEED_API_TOKEN`.

## Minimum set to go live (not counting recs, which ships flag-off)
Vercel · Supabase · Stripe (live) · Persona · Google OAuth + Twilio (via Supabase) ·
Resend (+ web-push) · EasyPost/Shippo · Cloudflare (domain) · Sentry + PostHog.
