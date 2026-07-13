-- HOTFIX: service_role table grants
-- Context: project created with "auto-expose new tables" OFF, so tables get
-- zero default grants. Migrations granted anon/authenticated selectively but
-- never service_role. RPC-based paths (SECURITY DEFINER, owner postgres)
-- worked; direct service-client table access (seed script, some admin paths)
-- failed with "permission denied". service_role bypasses RLS by design —
-- grants are the missing layer, and granting them restores intended behavior.

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Future tables/sequences created by migrations (owner postgres) inherit:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
