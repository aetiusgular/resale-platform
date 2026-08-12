-- Fee Model v3: buyer milestone rewards, elite seller program, boosted posts,
-- and the order-level discount that funds buyer rewards. All additive + flag-gated
-- in the app; safe to apply ahead of enabling the features.

-- ── Order discount (buyer loyalty reward), snapshotted like the fee amounts ──
alter table public.checkout_sessions add column if not exists discount_cents integer not null default 0;
alter table public.checkout_sessions add column if not exists reward_id uuid;
alter table public.orders           add column if not exists discount_cents integer not null default 0;

-- ── Elite seller program (> $25k trailing sales → founder outreach) ──────────
alter table public.profiles add column if not exists elite_program_eligible   boolean not null default false;
alter table public.profiles add column if not exists elite_program_notified_at timestamptz;

-- ── Buyer milestone rewards (one-time % discount at $1k/$5k/$10k rolling-year) ─
create table if not exists public.buyer_rewards (
  id                          uuid primary key default gen_random_uuid(),
  buyer_id                    uuid not null references public.profiles(id) on delete cascade,
  milestone_cents             integer not null,      -- 100000 / 500000 / 1000000
  discount_bps                integer not null,      -- 500 / 1000 / 1500
  cap_cents                   integer not null,      -- 5000 / 15000 / 30000
  status                      text not null default 'active', -- active|reserved|redeemed|expired
  granted_at                  timestamptz not null default now(),
  expires_at                  timestamptz not null default (now() + interval '365 days'),
  reserved_payment_intent_id  text,
  redeemed_at                 timestamptz,
  order_id                    uuid
);
create index if not exists buyer_rewards_buyer_status_idx on public.buyer_rewards (buyer_id, status);
alter table public.buyer_rewards enable row level security;
-- Buyers may read their own rewards; every write is service-role only (no write policy).
drop policy if exists buyer_rewards_select_own on public.buyer_rewards;
create policy buyer_rewards_select_own on public.buyer_rewards for select using (auth.uid() = buyer_id);

-- ── Boosted posts (paid promotion). Platform revenue; no Connect transfer ────
create table if not exists public.boosts (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null references public.listings(id) on delete cascade,
  seller_id                uuid not null references public.profiles(id) on delete cascade,
  package                  text not null,          -- spotlight_3 | feature_7 | premier_14
  duration_days            integer not null,
  amount_cents             integer not null,
  status                   text not null default 'pending', -- pending|active|expired|cancelled
  stripe_payment_intent_id text unique,
  starts_at                timestamptz,
  ends_at                  timestamptz,
  created_at               timestamptz not null default now()
);
create index if not exists boosts_listing_idx on public.boosts (listing_id);
create index if not exists boosts_status_ends_idx on public.boosts (status, ends_at);
alter table public.boosts enable row level security;
drop policy if exists boosts_select_own on public.boosts;
create policy boosts_select_own on public.boosts for select using (auth.uid() = seller_id);

-- Denormalized quick-lookup for browse ranking (active boost end time).
alter table public.listings add column if not exists boosted_until timestamptz;
create index if not exists listings_boosted_until_idx on public.listings (boosted_until);
