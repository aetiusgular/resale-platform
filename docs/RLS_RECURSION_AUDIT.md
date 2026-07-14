# RLS Recursion Audit — HF1

**Date:** 2026-07-13
**Author:** HF1 hotfix
**Source of truth:** live database (`rwabzxfyndpsqpmfmrim`) — queried via Management API

---

## Root Cause

`profiles_admin_all` (migration 000000) uses an EXISTS subquery that reads from the
`profiles` table itself:

```sql
EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
```

When Postgres evaluates RLS on `profiles`, it evaluates ALL permissive policies
including `profiles_admin_all`. That policy runs `SELECT FROM profiles`, which
re-enters RLS on `profiles`, which evaluates `profiles_admin_all` again →
infinite recursion: `"infinite recursion detected in policy for relation profiles"`.

Every other table whose admin policy does `EXISTS(SELECT FROM profiles)` also
triggers this loop indirectly:
`<other table> policy → SELECT from profiles → profiles RLS → profiles_admin_all → SELECT from profiles → ∞`

---

## Full Policy Survey (live DB, 2026-07-13)

Query used:
```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text ILIKE '%profiles%' OR with_check::text ILIKE '%profiles%')
ORDER BY tablename, policyname;
```

### Policies referencing `profiles` in qual/with_check

| Table | Policy | Cmd | Roles | Recursion type |
|-------|--------|-----|-------|---------------|
| `profiles` | `profiles_admin_all` | ALL | authenticated | **DIRECT** (self-referential) |
| `buyer_strikes` | `buyer_strikes_admin_read` | SELECT | authenticated | indirect |
| `comments` | `comments_admin_select` | SELECT | authenticated | indirect |
| `comments` | `comments_admin_update` | UPDATE | authenticated | indirect (qual + with_check) |
| `disputes` | `disputes_admin_read` | SELECT | authenticated | indirect |
| `listing_flags` | `listing_flags_admin_select` | SELECT | authenticated | indirect |
| `listings` | `listings_admin_all` | ALL | authenticated | indirect |
| `order_events` | `order_events_admin_read` | SELECT | authenticated | indirect |
| `orders` | `orders_admin_read` | SELECT | authenticated | indirect |

**Total: 9 policies** (1 direct self-recursive, 8 indirect).

No policies referencing `verified_checker` or `tier` in subqueries against `profiles`
were found — checker/tier columns are set exclusively via service_role routes and
never appear in RLS policy conditions.

---

## Fix Strategy

Create `public.is_admin()` as a `SECURITY DEFINER` function. Because SECURITY DEFINER
runs as the function owner (postgres superuser), it bypasses RLS entirely when it
reads `profiles`. No recursion is possible.

Rebuild all 9 policies substituting `is_admin()` for the EXISTS subquery.
Semantics are identical — only the execution path changes.

See migration: `supabase/migrations/20240101000014_fix_recursive_rls.sql`

---

## Impact Assessment

- **Signup blocked:** Any new user hitting `/api/auth/signup` could not write a profile
  row because the INSERT policy check triggered the recursive SELECT on `profiles`.
- **Middleware profile reads broken:** `getUser()` + profile select bounced users to
  `/onboarding` even after successful signup.
- **Admin paths broken:** All admin reads on `orders`, `listings`, `comments`, etc.
  recursed on every request.
- **Non-admin authenticated reads unaffected:** Policies using only `auth.uid() = id`
  do not subquery `profiles` and therefore did not recurse.

---

## Orphan User Cleanup (HF1 step 3)

Auth user found with email `aetiusgular@gmail.com` and no corresponding profiles row
(result of failed signup during recursion window):

- `auth.users.id` = `11511b14-c1fc-4630-8daa-4bcfc1284311`
- Deleted via Supabase Auth Admin API in HF1 step 3.
