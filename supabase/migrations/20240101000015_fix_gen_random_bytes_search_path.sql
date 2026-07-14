-- HOTFIX: generate_member_codes fails on live — gen_random_bytes (pgcrypto)
-- lives in the `extensions` schema on hosted Supabase, but the function's
-- pinned `SET search_path = public` hides it. Widen the search path to
-- include extensions (still pinned — no injection surface; both schemas are
-- trusted). Surfaced by HF1's live signup verification.

ALTER FUNCTION public.generate_member_codes(uuid, int)
  SET search_path = public, extensions;
