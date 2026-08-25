-- ════════════════════════════════════════════════════════════════════════════
-- G13 — Remove the invite/waitlist system entirely (founder decision 2026-08-24)
-- The platform launches OPEN: no invite gate, no waitlist, no referral codes.
-- App-side references removed in the same phase; nothing else touches these
-- objects (verified: invite_codes/waitlist appear only in 0002/0003/0012;
-- invited_by only in 0001-0003 + column-level grants, which drop with the column;
-- 0016's anon SELECT grant never included invited_by).
-- ════════════════════════════════════════════════════════════════════════════

-- RPCs first (they reference the tables). Two historical signatures exist:
-- 0002 created claim_invite_code(TEXT, UUID); 0003 replaced it with (TEXT).
DROP FUNCTION IF EXISTS claim_invite_code(TEXT, UUID);
DROP FUNCTION IF EXISTS claim_invite_code(TEXT);
DROP FUNCTION IF EXISTS generate_member_codes(UUID, INT);

-- Tables (their RLS policies and indexes drop with them)
DROP TABLE IF EXISTS invite_codes;
DROP TABLE IF EXISTS waitlist;

-- profiles.invited_by: FK profiles_invited_by_fkey, profiles_invited_by_idx, and
-- the 0001 column-level INSERT/UPDATE grants on this column all drop with it.
ALTER TABLE profiles DROP COLUMN IF EXISTS invited_by;
