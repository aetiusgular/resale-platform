# recs-engine live hosting (off-laptop) — setup for live integration testing

Goal: run recs-engine somewhere the platform can reach over the network (local dev
or deployed), so `RECS_ENABLED=true` exercises the real feed/telemetry/sync path.
**No GPU needed** — the default encoder is a deterministic STUB, which is exactly
right for testing the *integration* (real fashion-CLIP is a later, separate change).

## What actually has to run (from recs-engine `docker-compose.yml`)

Not just 2 services — the workers are what make it functional:
- `redis` — event streams + profile store
- `qdrant` — vector index
- `api` (ingest, :8000) · `feed` (:8001)
- `worker-scoring`, `worker-profile`, `worker-indexing`, `worker-graph` — REQUIRED
  (turn telemetry → profiles, and listings → Qdrant points). Without them, events
  land in Redis but nothing forms a profile and no listing gets indexed.
- `prometheus` / `grafana` — optional (observability).

## Fastest path: one small cloud VM running the whole compose

1. Provision a small Linux VM — 2 vCPU / 4 GB is plenty in stub mode
   (Hetzner CX22, DigitalOcean, Fly.io Machine, AWS Lightsail). No GPU.
2. Install Docker + Docker Compose; `git clone` the recs-engine repo onto it.
3. Set two secrets (compose env or a `.env` next to the compose file):
   ```
   RECS_INGEST__HMAC_SECRET=<long-random>   # MUST equal platform RECS_INGEST_HMAC_SECRET
   RECS_FEED__API_TOKEN=<long-random>       # MUST equal platform RECS_FEED_API_TOKEN
   ```
   (redis/qdrant URLs are already wired to the service names in compose.)
4. `docker compose up -d --build`  → redis, qdrant, api, feed, + the 4 workers.
5. `docker compose run --rm api python scripts/provision.py ensure`  (creates the
   Qdrant collection + `items` alias). `provision.py status` to inspect.
6. **Expose only `:8000` (ingest) and `:8001` (feed) to the internet, over HTTPS.**
   Put Caddy/nginx (auto-TLS) or a Cloudflare Tunnel in front:
   `ingest.yourdomain.com → :8000`, `recs.yourdomain.com → :8001`.
   NEVER expose redis (6379) or qdrant (6333) publicly.
7. Health check: `curl https://recs.yourdomain.com/healthz` and `.../…:8000/healthz`.

## Point the platform at it

Set these in the platform's server-side env (`.env.local` for local dev, or the
Vercel project's Environment Variables for a deployed app) — never `NEXT_PUBLIC_`:
```
RECS_ENABLED=true
RECS_INGEST_URL=https://ingest.yourdomain.com
RECS_FEED_URL=https://recs.yourdomain.com
RECS_INGEST_HMAC_SECRET=<same value as recs-engine RECS_INGEST__HMAC_SECRET>
RECS_FEED_API_TOKEN=<same value as recs-engine RECS_FEED__API_TOKEN>
```
The HMAC secret + feed token live only in the Next server (the `/api/recs/events`
route and the `lib/recs` client). They never ship to the browser.

## More prod-like alternative (managed services)

- Redis → Upstash / Redis Cloud → `RECS_REDIS__URL=rediss://…`
- Qdrant → Qdrant Cloud → `RECS_QDRANT__URL=…` + `RECS_QDRANT__API_KEY=…`
- api + feed + the 4 workers → deploy the recs-engine `Dockerfile` to Fly.io /
  Railway / Render as 2 web services + 4 worker processes, all pointing at the
  managed redis/qdrant. More moving parts than the single VM — use the VM to test,
  this to productionize.

## Verify it's live

- `curl -H "Authorization: Bearer $RECS_FEED_API_TOKEN" https://recs.yourdomain.com/v1/aesthetics` → 16 aesthetics.
- Platform (RECS_ENABLED=true) → browse → telemetry hits `/api/recs/events` →
  recs-engine ingest → `docker compose exec redis redis-cli XLEN events:raw` grows.
- Seed a listing → sync → `provision.py status` shows Qdrant points; feed returns items.

## Still needed on the recs-engine branch before listings sync works E2E
1. `POST /v1/listings` webhook (validate → XADD `listings:changes`) — none exists yet.
2. `preprocess.load_image` extended to fetch http(s) URLs (platform photos are Supabase URLs).
Both are the two permitted adapters (do NOT touch scoring/decay/feed logic).

## Encoder note (later, not now)
Default STUB encoder = correct plumbing, meaningless rankings. Real model is a
one-env change: `python scripts/export.py --base patrickjohncyh/fashion-clip` then
`RECS_ENCODER__KIND=onnx`. Only then consider a GPU box for the indexing worker.
