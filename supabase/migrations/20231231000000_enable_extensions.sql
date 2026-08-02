-- Migration: 20231231000000_enable_extensions
-- Dated BEFORE all others so it runs FIRST on any from-scratch environment. Captures the
-- one manual prod prerequisite that was never in the migration set: pg_cron, which
-- 0009_orders and 0010_messages use for cron.schedule (auto-release + message cleanup).
-- Without it, `supabase db reset` (local) and the first `db push` to a fresh project fail
-- at 0009 with: relation "cron.job" does not exist (SQLSTATE 42P01).
--
-- pgcrypto (gen_random_bytes) and uuid are enabled by default on Supabase projects, so
-- pg_cron is the only gap. Idempotent + additive. db-guard: safe.
--
-- NOTE for the EXISTING database (which already has pg_cron enabled by hand): because this
-- file is dated before migrations already applied there, `supabase db push` will flag it as
-- out-of-order. Mark it applied without running (it's a no-op there anyway):
--     npx supabase migration repair --status applied 20231231000000

create extension if not exists pg_cron;
