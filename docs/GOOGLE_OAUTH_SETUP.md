# Google sign-in / sign-up — setup

The code is built (button, `/api/auth/callback`, OAuth-aware onboarding) and gated behind
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`. It stays invisible until you (a) configure the Google
provider and (b) flip the flag. Nothing else changes for email/password users.

## How the flow works
1. User clicks **Continue with Google** (on `/enter/login` or `/onboarding/account`).
2. `signInWithOAuth` → Google → Supabase's `/auth/v1/callback` → Supabase creates the session
   and redirects to **our** `/api/auth/callback?next=…&invite=…`.
3. Our callback exchanges the code for a session, then routes:
   - has a profile → `next` (default `/browse`)
   - new user (no profile) → `/onboarding/account` to pick a username (invite code carried
     through as `?code=`). The app stays invite-gated: a Google user with no code is routed to
     `/enter` to claim one, exactly like email signup.

## 1) Google Cloud Console
1. Create/select a project → **APIs & Services**.
2. **OAuth consent screen**: External; app name, support email, developer email. Scopes:
   `email`, `profile`, `openid`. Add yourself as a test user while unverified.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized redirect URIs** — add the **Supabase** callback (not the app's):
   `https://rwabzxfyndpsqpmfmrim.supabase.co/auth/v1/callback`
5. (Optional) **Authorized JavaScript origins**: `http://localhost:3000` + your prod origin.
6. Copy the **Client ID** and **Client Secret**.

## 2) Supabase dashboard
1. **Authentication → Providers → Google** → enable; paste the Client ID + Client Secret; save.
2. **Authentication → URL Configuration**:
   - **Site URL**: your app URL (e.g. `http://localhost:3000` for dev, your domain for prod).
   - **Redirect URLs** (allowlist our callback): `http://localhost:3000/api/auth/callback` and
     `https://<your-domain>/api/auth/callback`. Supabase rejects any `redirectTo` not listed.

## 3) Enable the flag
Add to `.env.local` (and your prod env):
```
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```
Restart `pnpm dev` (NEXT_PUBLIC vars are inlined at build).

## 4) Smoke-test (browser — pnpm verify can't cover OAuth)
- `pnpm dev`, open `/enter/login` → the **Continue with Google** button appears.
- Click it → Google consent → back to the app. A brand-new Google account should land on
  `/onboarding/account` asking for a username; completing it (with a valid invite code) drops
  you into the app.
- An account that already has a profile should go straight to `/browse`.
- Test the invite path too: `/enter` → enter a code → `/onboarding/account?code=…` → the Google
  button there forwards the code through the round-trip.

## Notes
- Google emails are pre-verified, so no email-confirmation step for OAuth users.
- If a Google email matches an existing email/password account, linking depends on your
  Supabase "allow same email across providers" setting — decide that policy before launch.
