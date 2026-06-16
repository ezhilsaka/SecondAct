# Phase 2 Auth and App Shell Execution

Last updated: 2026-06-10

## 1) Purpose

This file is the execution-memory companion to `phase-2-auth-app-shell-plan.md`.

The plan explains what Phase 2 intends to build.
This file records what was actually executed, what passed, what changed, and what remains.

Phase 2 goal:

`Supabase Auth -> protected app shell -> profile bootstrap -> authenticated report APIs`

## 2) Working Rules For Phase 2

- Update this file after every implementation stage.
- Keep durable technical or functional clarifications in `chatbotNotes/backend-knowledge-base.md` when they establish lasting project rules.
- Avoid overloading Phase 1 execution notes with Phase 2 details.
- Keep the implementation incremental and build-safe.
- Prefer existing service boundaries and dependency-injection patterns.
- Do not add a Prisma schema migration unless a documented blocker requires it.

## 3) Manual Prerequisites

The user confirmed on 2026-06-06 that the manual prerequisites are complete:

- Supabase Auth URL configuration
- Google OAuth provider setup
- Email OTP/provider setup
- Local Supabase env values prepared

## 4) Current Phase Status

Current status:

- Stage 0 baseline audit: complete
- Stage 1 dependency install: complete
- Stage 2 Supabase client helpers: complete
- Stage 3 login/callback/logout: complete
- Stage 4 profile bootstrap: complete
- Stage 5 protected app shell: complete
- Stage 6 proxy auth guard: complete
- Stage 7 report API auth migration: complete
- Stage 6/7 manual smoke verification: complete except owned-portfolio positive-path API check, deferred until portfolio UI/test data is available
- Stage 8 landing CTA wiring: complete
- Stage 9 verification: complete
- Stage 10 documentation updates and Phase 2 closeout audit: complete

Review checkpoint:

- Phase 2 engineering closeout is complete.
- Remaining human checkpoint: user can run the Stage 8/9 manual landing CTA smoke checklist before pushing if desired.
- Deferred non-blocker: strong owned-portfolio positive-path report API smoke check waits for portfolio UI/test data in a later phase.

## 5) Stage 0: Baseline Audit

Status: complete on 2026-06-06.

Deep-dive plan:

1. Confirm current worktree state.
2. Confirm `@supabase/ssr` is not installed yet.
3. Confirm known Phase 2 gaps still exist:
   - permissive `src/middleware.ts` auth stub
   - `X-User-Id` report API placeholder auth
   - no `src/proxy.ts` auth guard yet
4. Re-run baseline verification before implementation.

Clarifying questions:

- None for Stage 0. The user confirmed the manual prerequisites are complete.

Findings:

- Worktree was clean at the start of Stage 0.
- `@supabase/supabase-js@2.103.0` is installed.
- `@supabase/ssr` is not installed yet.
- `src/middleware.ts` still contains the known permissive auth stub.
- Report-run API routes still use `X-User-Id`.
- `chatbotNotes/phase-2-auth-app-shell-execution.md` did not exist before this stage.

Verification:

- `npm test`: passed, 245 tests across 26 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed

Expected warning:

- `npm run build` still reports the Next.js 16 `middleware` file convention deprecation.
- This is expected before Stage 6, where the guard should migrate to `src/proxy.ts`.

## 6) Stage 1: Install Auth Runtime Dependencies

Status: complete on 2026-06-06.

Goal:

- Add `@supabase/ssr` for Supabase cookie-based SSR auth.

Deep-dive plan:

1. Install `@supabase/ssr` as a runtime dependency.
2. Keep `@supabase/supabase-js`.
3. Review `package.json` and `package-lock.json` changes.
4. Confirm no unexpected dependency churn.
5. Run focused verification after install.

Clarifying questions:

- None. The dependency is required by the Phase 2 plan and is currently absent.

Expected files:

- `package.json`
- `package-lock.json`

Expected verification:

- `npm ls @supabase/ssr @supabase/supabase-js`
- `npm run typecheck`
- `npm run lint`

Execution notes:

- Initial sandboxed `npm install @supabase/ssr` failed with DNS/network error against `registry.npmjs.org`.
- Re-ran the same install with approved network access.
- Installed `@supabase/ssr@0.10.3`.
- npm resolved `@supabase/supabase-js` to `2.107.0`.
- Updated the direct `@supabase/supabase-js` dependency floor from `^2.103.0` to `^2.107.0` so `package.json` matches the installed peer-compatible runtime.
- `package-lock.json` now includes `cookie@1.1.1`, required by `@supabase/ssr`.
- Supabase realtime no longer pulls the removed transitive `ws` / `@types/ws` entries in the updated lockfile.

Files changed:

- `package.json`
- `package-lock.json`

Verification:

- `npm ls @supabase/ssr @supabase/supabase-js @supabase/auth-js`: passed
  - `@supabase/ssr@0.10.3`
  - `@supabase/supabase-js@2.107.0`
  - `@supabase/auth-js@2.107.0`
- `npm test`: passed, 245 tests across 26 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `npm audit --audit-level=high`: passed with no high-severity findings

Expected warnings / residual risk:

- `npm run build` still reports the expected Next.js 16 `middleware` deprecation warning.
- `npm audit` still reports moderate advisories in existing Prisma/Next tooling-related dependency paths. This matches the prior project posture: do not run `npm audit fix --force` unless a deliberate tooling upgrade pass is scheduled.

Knowledge-base update:

- No backend knowledge-base update was needed for Stage 1. No durable technical or functional decision changed beyond the dependency install already recorded here.

## 7) Stage 2: Create Supabase Client Helpers

Status: complete on 2026-06-06.

Goal:

- Centralize build-safe browser, server, and proxy Supabase auth client creation.

Deep-dive plan:

1. Follow current Supabase SSR guidance for `@supabase/ssr`.
2. Use `createBrowserClient` for client/browser auth.
3. Use `createServerClient` for server components, route handlers, and server actions.
4. Use a separate proxy helper with `getAll` / `setAll` cookie methods.
5. Use `supabase.auth.getClaims()` for server-side auth protection instead of trusting `getSession()`.
6. Keep the existing service-role Supabase admin storage client separate from auth/session helpers.
7. Keep helper initialization lazy/build-safe.
8. Add focused tests for config validation and helper behavior where practical.

Clarifying questions:

- None. The Phase 2 plan already chose Supabase Auth and the existing env names. The implementation should keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` for compatibility.

Current-doc findings:

- Supabase SSR docs say `@supabase/ssr` configures Supabase clients to use cookies.
- Supabase now recommends browser and server client utilities for Next.js.
- Supabase notes that Next.js Server Components cannot write cookies, so Proxy should refresh/store tokens.
- Supabase recommends `getClaims()` for protecting pages and user data, and warns not to trust `getSession()` in server code for authorization.
- `@supabase/ssr@0.10.3` type definitions prefer `getAll` / `setAll` cookie methods over deprecated `get` / `set` / `remove`.

Expected files:

- `src/lib/supabase/config.ts`
- `src/lib/supabase/browser.ts`
- `src/server/auth/authenticated-user.ts`
- `src/server/auth/supabase-server.ts`
- `src/server/auth/supabase-proxy.ts`
- focused tests under `src/server/auth/` and/or `src/lib/supabase/`

Expected verification:

- focused tests for new helpers
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Execution notes:

- Added a build-safe public Supabase config helper that lazily validates:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Kept the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` name for Phase 2 compatibility, even though Supabase docs now increasingly reference publishable keys.
- Added a browser Supabase client factory using `createBrowserClient`.
- Added request-scoped server Supabase client creation using `createServerClient` and Next.js `cookies()`.
- Added server auth helpers:
  - `getAuthenticatedUser()`
  - `requireAuthenticatedUser()`
  - `AuthenticationRequiredError`
- Added a shared claims mapper so both server and proxy helpers can convert verified Supabase JWT claims into the app's authenticated-user shape without coupling proxy code to `next/headers`.
- Added a proxy Supabase client helper using `getAll` / `setAll` cookie methods.
- The proxy helper writes refreshed cookies to both:
  - the request, so downstream server rendering sees the fresh token
  - the response, so the browser receives the fresh token
- The proxy helper also applies the cache-control headers passed by `@supabase/ssr` when cookies are refreshed.
- The existing service-role `supabaseAdmin` storage client remains separate and was not reused for auth/session reads.
- No route behavior changed in this stage. Login, callback, logout, protected route enforcement, and report API auth migration remain later stages.

Files changed:

- `src/lib/supabase/config.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/config.test.ts`
- `src/lib/supabase/browser.test.ts`
- `src/server/auth/authenticated-user.ts`
- `src/server/auth/authenticated-user.test.ts`
- `src/server/auth/supabase-server.ts`
- `src/server/auth/supabase-server.test.ts`
- `src/server/auth/supabase-proxy.ts`
- `src/server/auth/supabase-proxy.test.ts`

Verification:

- Focused helper tests:
  - `npx vitest run src/lib/supabase/config.test.ts src/lib/supabase/browser.test.ts src/server/auth/authenticated-user.test.ts src/server/auth/supabase-server.test.ts src/server/auth/supabase-proxy.test.ts`
  - passed, 15 tests across 5 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 260 tests across 31 files
- `npm run build`: passed

Expected warnings / residual risk:

- `npm run build` still reports the expected Next.js 16 `middleware` deprecation warning.
- This remains scheduled for Stage 6, where `src/middleware.ts` should be replaced by `src/proxy.ts`.
- Auth helper tests use mocks for Supabase SSR and Next.js cookie APIs. Real Google/OTP session validation still belongs to the later browser/manual validation stages.

Knowledge-base update:

- No backend knowledge-base update was needed for Stage 2. The implementation followed existing Phase 2 plan decisions and recorded the auth-helper architecture here.

## 8) Stage 3: Auth Callback, Login, OTP, and Logout

Status: complete on 2026-06-06.

Goal:

- Implement the basic user sign-in and sign-out flows without moving into profile bootstrap, app-shell protection, or report API auth migration.

Deep-dive plan:

1. Add a shared relative-only redirect helper so `next` handling is consistent and external redirects are rejected.
2. Add `/login` as a public page.
3. Add a client-side login form with:
   - Google OAuth start
   - email OTP request
   - OTP code verification
   - clear loading states
   - generic user-facing error messages
4. Add `/auth/callback` route handler.
5. In the callback handler:
   - exchange a Supabase OAuth PKCE `code` for a session
   - support email magic-link/token-hash callback compatibility when present
   - preserve only a safe relative `next` redirect
   - redirect authenticated users to `/app` by default
   - redirect callback failures back to `/login` with a generic error code
6. Add `/auth/logout` route handler.
7. In the logout handler:
   - sign out through the Supabase server client
   - let Supabase clear session cookies
   - redirect to `/`
8. Add focused tests for redirect safety, callback behavior, and logout behavior.
9. Run focused tests and full verification gates.
10. Visually verify the login page in a browser after starting the dev server.

Clarifying questions:

- None. The user confirmed the manual Supabase/Google/email prerequisites are complete.
- The updated goal says to stop for review after Step 3, so implementation will pause after Stage 3 verification.

Current-doc findings:

- Supabase Google OAuth with SSR/PKCE should call `signInWithOAuth` with a `redirectTo` callback route, then exchange the callback `code` for a session.
- Supabase email OTP sends an OTP through `signInWithOtp`, then creates a session through `verifyOtp` with `{ email, token, type: "email" }`.
- Supabase magic-link/token-hash compatibility can be handled by `verifyOtp` with `{ token_hash, type }`.
- Supabase notes that auth routes which set cookies should avoid cache leakage. The Stage 2 proxy helper already applies refresh headers; Stage 3 callback/logout routes should also avoid cacheable auth responses.
- `next` redirect values must remain relative-only to avoid open redirects.

Expected files:

- `src/lib/auth/redirect.ts`
- `src/lib/auth/redirect.test.ts`
- `src/app/login/page.tsx`
- `src/components/auth/AuthLoginForm.tsx`
- `src/components/auth/AuthLoginForm.module.css`
- `src/app/login/LoginPage.module.css`
- `src/app/auth/callback/route.ts`
- `src/app/auth/callback/route.test.ts`
- `src/app/auth/logout/route.ts`
- `src/app/auth/logout/route.test.ts`

Expected verification:

- focused Stage 3 tests
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- browser check for `/login`

Execution notes:

- Added a shared auth redirect helper with relative-only `next` sanitization.
- Added `/login` as a public sign-in page.
- Added a client-side login form that supports:
  - Google OAuth start through `signInWithOAuth`
  - email OTP request through `signInWithOtp`
  - OTP code verification through `verifyOtp`
  - loading states for Google, email request, and OTP verification
  - generic user-facing error messages
- Google and email OTP request flows both build `/auth/callback?next=...` with sanitized relative redirect state.
- Added `/auth/callback` route handler.
- The callback handler:
  - exchanges OAuth PKCE `code` values through `exchangeCodeForSession`
  - supports token-hash email callback compatibility for supported email/magic-link/signup/invite types
  - redirects successful auth to the sanitized `next` path, defaulting to `/app`
  - redirects failed callbacks to `/login?error=auth_callback_failed&next=...`
  - sets `Cache-Control: private, no-store` on auth redirects
- Added `/auth/logout` route handler for both `GET` and `POST`.
- Logout signs out through the Supabase server client, then redirects to `/` with `Cache-Control: private, no-store`.
- Did not implement profile bootstrap, `/app` shell, proxy enforcement, report API auth migration, or landing CTA rewiring in this stage.

Files changed:

- `src/lib/auth/redirect.ts`
- `src/lib/auth/redirect.test.ts`
- `src/app/login/page.tsx`
- `src/app/login/LoginPage.module.css`
- `src/components/auth/AuthLoginForm.tsx`
- `src/components/auth/AuthLoginForm.module.css`
- `src/app/auth/callback/route.ts`
- `src/app/auth/callback/route.test.ts`
- `src/app/auth/logout/route.ts`
- `src/app/auth/logout/route.test.ts`

Verification:

- Focused Stage 3 tests:
  - `npx vitest run src/lib/auth/redirect.test.ts src/app/auth/callback/route.test.ts src/app/auth/logout/route.test.ts`
  - passed, 13 tests across 3 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 273 tests across 34 files
- `npm run build`: passed
- Browser verification:
  - `npm run dev` was started after sandbox approval; `/login?next=/app` rendered expected content and controls.
  - Dev browser console showed a Next.js/Turbopack invariant error, so production verification was run as a cleaner check.
  - `npm run start` served the production build successfully.
  - Production `/login?next=/app` rendered with:
    - title `Sign in | Second Act`
    - one `Continue with Google` button
    - one email input
    - one `Continue with Email` button
  - Email input accepted typed text in the browser.
  - A reload-time `Connection closed` console message appeared when the browser interrupted a previous page stream; a follow-up idle check produced no new console errors.

Expected warnings / residual risk:

- `npm run build` still reports the expected Next.js 16 `middleware` deprecation warning.
- This remains scheduled for Stage 6.
- Real Google OAuth and email OTP delivery/verification were not manually completed in the browser because that would use live external auth/provider flows. The route/client code paths are covered by focused tests and are ready for manual validation.
- `/app` is still not implemented/protected. Successful auth redirects default to `/app`, which will be completed in later stages after this review checkpoint.

Knowledge-base update:

- No backend knowledge-base update was needed for Stage 3. No separate technical or functional question changed the durable project rules.

Review stop:

- Phase 2 execution is paused here for user review, per the updated goal to stop after Step 3.

Post-review security hardening:

- A security scan flagged a potential open-redirect bypass class around odd redirect inputs such as raw backslashes and tab/newline characters.
- The existing sanitizer already rejected absolute URLs, protocol-relative URLs, and raw backslash host pivots through its origin check.
- Hardened `sanitizeRelativeRedirect()` to explicitly reject before URL parsing:
  - raw backslashes
  - raw ASCII control characters
  - percent-encoded ASCII control characters
  - percent-encoded slash or backslash characters
- Added regression tests for:
  - `/\\evil.com`
  - `/\tevil.com`
  - `/\nevil.com`
  - `/%2f%2fevil.com`
  - `/%5C%5Cevil.com`
  - `/%09evil.com`
  - encoded CRLF header-injection style input
- Verification after hardening:
  - focused auth route/security tests passed, 16 tests across 3 files
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, 276 tests across 34 files
  - `npm run build`: passed

Post-review login interactivity fix:

- Manual browser testing reported that:
  - `Continue with Google` appeared to do nothing
  - `Continue with Email` appeared to do nothing
  - no OTP email was received
- Root causes found:
  - The static `Content-Security-Policy` in `next.config.ts` used `script-src 'self'`, which blocked Next.js App Router inline bootstrap/RSC scripts. The page rendered HTML, but React did not hydrate, so click handlers were inert.
  - After hydration was restored, the browser Supabase client still failed because `getSupabasePublicConfig()` used dynamic `process.env[name]` access. Next.js client bundles require direct `process.env.NEXT_PUBLIC_*` references for public env inlining.
  - The original CSP also had `connect-src 'self'`, which would have blocked browser OTP requests to the Supabase project origin even after hydration.
- Changes made:
  - Moved CSP generation out of static `next.config.ts` and into request middleware with a per-request nonce so Next can nonce App Router bootstrap scripts.
  - Kept static non-CSP security headers in `next.config.ts`.
  - Added the configured Supabase origin to `connect-src`.
  - Added the existing Google Fonts origins to `style-src` and `font-src`.
  - Updated the Supabase public config helper to use direct `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` references by default.
  - Hardened the login form so Supabase initialization/call failures show the generic UI error and release the pending button state.
  - Added dev-only sanitized auth error logging for future local debugging.
- Files changed:
  - `next.config.ts`
  - `src/middleware.ts`
  - `src/lib/security/content-security-policy.ts`
  - `src/lib/security/content-security-policy.test.ts`
  - `src/lib/supabase/config.ts`
  - `src/lib/supabase/config.test.ts`
  - `src/components/auth/AuthLoginForm.tsx`
- Verification after fix:
  - Focused config/CSP tests passed, 10 tests across 2 files
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, 282 tests across 35 files
  - `npm run build`: passed
  - Browser `/login` check on the restarted dev server:
    - no Next hydration invariant error
    - no CSP font errors
    - Google button navigated to the Google Accounts OAuth flow
    - email OTP request was verified with a Playwright route interception, so no real email was sent; the form issued a POST to Supabase `/auth/v1/otp` and displayed `Code sent. Check your email.` on a mocked success response
  - Browser `/` and `/legal` checks also passed with nonce-bearing inline scripts and no console errors.
- Expected warnings / residual risk:
  - `npm run build` still reports the expected Next.js 16 `middleware` deprecation warning.
  - This remains scheduled for Stage 6.
  - Live email delivery to the user's inbox still needs manual provider validation because the automated browser check intentionally intercepted the OTP request to avoid sending a real email.

Post-review OTP provider-template finding:

- Manual email OTP testing reported:
  - the login page showed `Code sent. Check your email.`
  - the OTP code input appeared
  - the received email did not contain a code
  - the received email used the default `Confirm your signup` copy:
    - `Follow this link to confirm your user`
    - `Confirm your mail`
  - clicking the link showed a browser `page can't be displayed` error
- Root cause:
  - For a first-time email/passwordless user, Supabase can send the `Confirm sign up` email template instead of the `Magic link or OTP` template.
  - The current `Confirm sign up` template is link-only and does not expose `{{ .Token }}`, so it is incompatible with the app's OTP code-entry UI.
- Code assessment:
  - The app's `signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })` call remains the intended Phase 2 entrypoint.
  - The app's `verifyOtp({ email, token, type: "email" })` call remains compatible with Supabase's current email OTP guidance for signup/sign-in.
  - No application-code change is required for this specific finding unless the product chooses to replace code-entry UX with link-first UX.
- Provider configuration required:
  - Update the Supabase `Confirm sign up` template to include the six-digit `{{ .Token }}`.
  - Keep or update the `Magic link or OTP` template to include the six-digit `{{ .Token }}` as well.
  - Use Second Act user-facing copy in both templates.
  - If a fallback link remains in either template, verify the redirect URL is allow-listed and routes back to `/auth/callback`.
- Manual retest required before Stage 3 provider signoff:
  - delete or use a fresh test email so the first-time path is exercised
  - request email code from `/login?next=/`
  - confirm the received first-time email includes a visible six-digit code
  - enter the code in the app
  - confirm redirect to `/`
  - repeat once with the same email to confirm the returning-user template path also includes a visible six-digit code
- Manual follow-up on 2026-06-08:
  - after the Supabase email template update, the email now sends a code instead of only the confirmation link
  - entering the code completes the OTP verification path far enough to redirect
  - the redirect currently lands on a `404 Not Found` page when using the default `/app` destination
  - this is expected at this checkpoint because `/app` is still pending until Stage 5
  - for Stage 3 provider smoke signoff before `/app` exists, use `/login?next=/` or `/login?next=/legal`

Post-review logout validation gap:

- User correctly noted on 2026-06-08 that the Stage 3 plan includes confirming logout clears the session.
- Current verified state:
  - `/auth/logout` route exists for `GET` and `POST`
  - focused logout route test passed on 2026-06-08:
    - `npm test -- --run src/app/auth/logout/route.test.ts`
    - 2 tests passed
  - the test confirms the route calls Supabase `signOut()` and redirects to `/`
- Remaining manual provider/session check before moving past Stage 3 signoff:
  - sign in with Google or email OTP using `/login?next=/legal`
  - confirm login redirects to `/legal`
  - visit `/auth/logout`
  - confirm it redirects to `/`
  - request `/login?next=/legal` again and confirm the app no longer has a live Supabase session
  - after Stage 5/6 protected `/app` and proxy guard exist, repeat logout from the app shell and confirm `/app` redirects back to `/login`
- Important note:
  - before Stage 5/6, there is no protected app shell yet, so manual logout validation can confirm route behavior and browser redirect, but the strongest protected-route proof comes after the app shell/proxy guard is implemented.

## 9) Stage 4: Profile Bootstrap

Status: complete on 2026-06-08.

Goal:

- Ensure every authenticated Supabase user has a corresponding Second Act application profile and usage row before entering the protected product shell.

Deep-dive design decisions:

1. Keep `auth.users` as the identity source of truth and `public.user_profiles` as the Second Act app-profile source of truth.
2. Use a dedicated server-side bootstrap service instead of embedding profile creation directly inside route handlers.
3. Run bootstrap after successful `/auth/callback` session establishment, then run it again from the `/app` layout as an idempotent safety net.
4. Preserve existing profile rows and never overwrite names or handles for returning users.
5. Ensure `user_usage` exists for both newly created and pre-existing profiles.
6. Generate the initial `investor_handle` from the email local part, with retry behavior for unique-handle collisions.
7. Use Google profile metadata for names when present; route first-time email OTP users to a post-verification profile-completion step when metadata is absent.
8. Keep logs structured and token-safe; do not log Supabase tokens or raw auth payloads.

Files changed:

- `src/server/auth/profile-bootstrap.ts`
- `src/server/auth/profile-bootstrap.test.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/callback/route.test.ts`

Execution notes:

- Added `bootstrapAuthenticatedUserProfile()` with dependency-injected repository and logger support.
- Added explicit bootstrap errors for missing email, profile bootstrap failure, and handle collision retry behavior.
- Added dynamic profile-bootstrap import inside `/auth/callback` so the callback route avoids eager Prisma loading during module import.
- Updated both OAuth code exchange and email token-hash callback paths to bootstrap the profile before redirecting into the app.
- If bootstrap fails after a Supabase session is established, the callback signs out and redirects to `/login?error=auth_callback_failed&next=/app`.

Focused verification:

- `npm test -- --run src/server/auth/profile-bootstrap.test.ts src/app/auth/callback/route.test.ts src/app/auth/logout/route.test.ts src/components/app/AppShell.test.tsx`
- Result: passed, 14 tests across 4 files.

Coverage highlights:

- Existing profiles are loaded without overwriting profile fields.
- Missing profiles are created from Google metadata.
- Email OTP users without profile metadata are routed to the profile-completion step.
- Investor-handle collision retries are covered.
- Missing email fails safely.
- Callback bootstrap failure signs out instead of leaving a half-initialized app session.

Manual test follow-up on 2026-06-09:

- Google sign-in reached `/auth/callback`, but then redirected to `/login?error=auth_callback_failed&next=/app`.
- Server diagnostics showed:
  - `reason: profile_bootstrap_failed`
  - Prisma `P2002`
  - unique constraint failed on `user_profiles.email`
- Root cause:
  - the Supabase Auth user ID was `fc44051f-da59-4d77-81f4-9db0214a6979`
  - an older `public.user_profiles` row already existed for the same email under a different profile ID
  - this can happen in local/dev when Auth users are deleted/recreated or provider testing creates a new identity for the same email
- Code hardening added:
  - bootstrap now checks for email-linked profiles before creating a new row
  - a mismatched email/profile ID fails as `PROFILE_EMAIL_ALREADY_LINKED` instead of a raw Prisma unique-constraint failure
  - callback failure logging remains sanitized and token-safe
- Local cleanup performed:
  - read-only check confirmed the stale profile had zero portfolios, holdings, report runs, or report artifacts
  - deleted the stale dependency-free `public.user_profiles` row
  - related `public.user_usage` cleanup cascaded through the existing relation
- Manual retest:
  - repeat Google sign-in to `/app`
  - confirm a new `user_profiles` row is created with `id = auth.users.id`
  - confirm `user_usage` is created for the same ID
- Email OTP follow-up:
  - email OTP sign-in successfully created the app profile and reached `/app`
  - Next.js dev overlay showed `Console Error` for `User profile bootstrap failed`
  - terminal logs showed Prisma `P2002` from `userUsage.upsert()` on `user_id`
  - root cause was a benign race where a second `/app` bootstrap tried to ensure `user_usage` immediately after the first bootstrap had already created it
  - code hardening added:
    - `PrismaProfileBootstrapRepository.ensureUserUsage()` now treats `P2002` as success because the row already exists
    - focused tests cover the user-usage unique-constraint race and still rethrow non-unique Prisma failures
  - the in-page console overlay is a Next.js dev-only reaction to `console.error`, but the underlying idempotency bug was real and is now fixed
- Email OTP name follow-up:
  - manual testing showed that first-time email OTP users need an explicit first/last name capture step
  - the login page should not reveal whether an email is new or returning before authentication
  - removed always-visible first/last name fields from the login page
  - after email OTP verification, the client routes to `/login?step=profile&next=/app`
  - returning users with an existing profile are immediately redirected from `/login?step=profile` to the requested app path
  - first-time email OTP users without profile metadata complete first and last name inside the same login visual shell
  - profile bootstrap now throws `PROFILE_COMPLETION_REQUIRED` instead of creating placeholder names when metadata is missing
  - `/app` and `/auth/callback` redirect profile-completion-required users to `/login?step=profile` while preserving the authenticated session
  - `/profile/setup` remains a compatibility redirect into `/login?step=profile`
  - focused coverage now confirms profile completion creates `user_profiles.first_name` and `user_profiles.last_name`
- Email OTP rate-limit follow-up:
  - during repeated manual tests, Supabase returned `email rate limit exceeded` from the browser OTP request path
  - the app was previously showing the generic auth failure, which made the issue look like an account/login failure
  - the login form now maps email OTP send/verify rate-limit responses to a clear wait-and-retry message while keeping credential/account failures generic
- Design follow-up:
  - manual testing also noted login/app shell visual inconsistencies, including brand/logo differences from the landing page
  - this is accepted for the current backend/auth checkpoint
  - a fuller UX redesign is deferred until the backend logic is further along

## 10) Stage 5: Protected App Shell

Status: complete on 2026-06-08.

Goal:

- Add the first protected `/app` surface, backed by the authenticated user and profile bootstrap, without moving into Stage 6 proxy/global-route enforcement.

Deep-dive design decisions:

1. Protect `/app` at the server layout boundary for this stage.
2. Redirect unauthenticated requests to `/login?next=/app`.
3. Keep global proxy/middleware auth enforcement out of scope until Stage 6.
4. Render a usable shell with brand, authenticated profile display, logout, and future-area navigation placeholders.
5. Keep portfolio/report actions as disabled placeholders until the product reaches those phases.

Files changed:

- `src/app/app/layout.tsx`
- `src/app/app/page.tsx`
- `src/app/app/page.module.css`
- `src/app/app/account/page.tsx`
- `src/app/app/account/page.module.css`
- `src/components/app/AppShell.tsx`
- `src/components/app/AppShell.module.css`
- `src/components/app/AppShell.test.tsx`

Execution notes:

- Added `/app` dashboard placeholder with product-status and report-pipeline status cards.
- Added `/app/account` placeholder showing the bootstrapped profile foundation.
- Added app shell navigation entries for Dashboard, Portfolios, Reports, and Account.
- Added app-shell logout form that posts to `/auth/logout`.
- The `/app` layout calls `requireAuthenticatedUser()` and then `bootstrapAuthenticatedUserProfile()`.
- Stage 6 work was intentionally not started: report APIs still use the current placeholder auth path, and global route protection still remains a later proxy step.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 289 tests across 37 files.
- `npm run build`: passed.
- Browser smoke check:
  - visited `http://localhost:3000/app` without an authenticated browser session
  - confirmed redirect to `http://localhost:3000/login?next=/app`
  - confirmed the sign-in page rendered
  - confirmed no browser console errors were captured

Expected warning:

- `npm run build` still reports the expected Next.js 16 `middleware` deprecation warning.
- This remains scheduled for Stage 6 and was not changed during Stage 4/5.

Manual test gate before Stage 6:

- Sign in with Google using the default `/app` destination.
- Confirm `/app` renders instead of the prior `404 Not Found`.
- Confirm Supabase has the authenticated user under Auth Users.
- Confirm `public.user_profiles` has one row whose `id` matches the Supabase auth user ID.
- Confirm `public.user_usage` has one row for the same user ID.
- Sign out from the app shell logout button.
- Confirm logout redirects to `/`.
- Visit `/app` again and confirm it redirects to `/login?next=/app`.
- Repeat with email OTP and confirm the returning-user path does not create duplicate profile rows.

Stop point:

- Implementation was intentionally stopped after Stage 5 until the user completed manual auth/app-shell testing.
- The user signed off that manual testing looked good before Stage 6 began.

## 11) Stage 6: Proxy Auth Guard

Status: complete on 2026-06-10.

Goal:

- Replace the permissive `src/middleware.ts` auth stub with a real session-aware route guard using the current Next.js 16 proxy convention.

Deep-dive design decisions:

1. Migrate the request guard to `src/proxy.ts` and remove `src/middleware.ts`.
2. Preserve the per-request CSP nonce behavior from the old middleware so App Router hydration remains intact.
3. Use a default-deny posture with an explicit public allow-list:
   - `/`
   - `/legal`
   - `/login`
   - `/profile/setup` as a compatibility redirect into the login profile step
   - `/auth/callback`
   - `/auth/logout`
   - `/api/health`
   - Next/static/public asset prefixes
4. Use `getAuthenticatedUserForProxy()` from the Supabase proxy helper for protected requests.
5. Redirect unauthenticated browser requests to `/login?next=<original path and query>`.
6. Return JSON `401` with code `UNAUTHORIZED` for unauthenticated API requests.
7. Keep route handlers as the authoritative server-side authorization gate; proxy is only the first gate.

Files changed:

- `src/proxy.ts`
- `src/proxy.test.ts`
- `src/middleware.ts` deleted
- `next.config.ts`

Execution notes:

- The deprecated Next.js `middleware.ts` file was removed.
- The new proxy keeps the CSP header on both the forwarded request and outgoing response.
- Public routes do not call the Supabase session helper.
- Protected routes call the Supabase proxy helper so refreshed cookies can be written to the continuing response.
- `/profile/setup` remains public only as a compatibility redirect route; the actual profile-completion UI is still rendered through `/login?step=profile`.

Focused verification:

- `npm test -- --run src/proxy.test.ts src/server/auth/api-auth.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/api/v1/report-runs/[runId]/pdf/route.test.ts src/server/auth/supabase-proxy.test.ts`
- Result: passed, 31 tests across 6 files.
- Full verification after Stage 6/7:
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, 311 tests across 40 files
  - `npm run build`: passed
  - build no longer reports the Next.js 16 deprecated `middleware.ts` warning

Coverage highlights:

- Public `/login` is allowed without session.
- Public `/profile/setup` compatibility route is allowed without session.
- Public `/images/*` asset prefix is allowed without session.
- Authenticated `/app` request is allowed.
- Unauthenticated `/app/account?tab=profile` redirects to `/login?next=/app/account?tab=profile`.
- Unauthenticated `/api/v1/report-runs` returns JSON `401 UNAUTHORIZED`.

## 12) Stage 7: Report API Auth Migration

Status: complete on 2026-06-10.

Goal:

- Replace the temporary `X-User-Id` report API auth mechanism with the authenticated Supabase session user ID.

Deep-dive design decisions:

1. Keep the existing `ReportRunService` contract: route handlers still pass a `userId` into the service layer.
2. Change the source of `userId` from a request header to the authenticated Supabase session.
3. Add a small API auth helper so route handlers share the same `401 UNAUTHORIZED` response shape.
4. Preserve dynamic imports for `ReportRunService` to avoid widening build-time env/import risk.
5. Preserve existing ownership behavior: authenticated-but-not-owner remains the service layer's existing not-found behavior.
6. Do not add a dev-only spoof header replacement in this stage.

Files changed:

- `src/server/auth/api-auth.ts`
- `src/server/auth/api-auth.test.ts`
- `src/app/api/v1/report-runs/route.ts`
- `src/app/api/v1/report-runs/route.test.ts`
- `src/app/api/v1/report-runs/[runId]/route.ts`
- `src/app/api/v1/report-runs/[runId]/route.test.ts`
- `src/app/api/v1/report-runs/[runId]/pdf/route.ts`
- `src/app/api/v1/report-runs/[runId]/pdf/route.test.ts`

Execution notes:

- `POST /api/v1/report-runs` now calls `getAuthenticatedApiUserId()`.
- `GET /api/v1/report-runs/:runId` now calls `getAuthenticatedApiUserId()`.
- `GET /api/v1/report-runs/:runId/pdf` now calls `getAuthenticatedApiUserId()`.
- Missing or invalid session returns:
  - status: `401`
  - code: `UNAUTHORIZED`
  - message: `Authentication is required.`
- The route tests now explicitly send a spoofed `x-user-id` header and confirm the service still receives the mocked authenticated session user ID.

Focused verification:

- Same focused test command as Stage 6.
- Result: passed, 31 tests across 6 files.
- Full verification after Stage 6/7:
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, 311 tests across 40 files
  - `npm run build`: passed

Coverage highlights:

- Successful report-run creation uses the authenticated session user ID.
- Successful report-run status lookup uses the authenticated session user ID.
- Successful report PDF signed URL lookup uses the authenticated session user ID.
- Spoofed `x-user-id` headers are ignored by all migrated report API routes.
- Unauthenticated API calls return `401 UNAUTHORIZED`.
- Existing validation and not-found behavior remains covered.

Manual verification checklist for Stage 6 and Stage 7:

1. Start the local app with `npm run dev`.
2. In a signed-out or incognito browser session:
   - visit `/login`; it should render normally
   - visit `/`; it should render normally
   - visit `/legal`; it should render normally
   - visit `/app`; it should redirect to `/login?next=%2Fapp`
   - visit `/app/account?tab=profile`; it should redirect to `/login?next=%2Fapp%2Faccount%3Ftab%3Dprofile`
3. While still signed out, run this in the browser console:
   - `await fetch("/api/v1/report-runs").then(async (r) => ({ status: r.status, body: await r.json() }))`
   - expected: status `401`, body code `UNAUTHORIZED`
4. Sign in with Google or email OTP.
5. After sign-in:
   - `/app` should load the authenticated app shell
   - refresh `/app`; it should stay authenticated
   - app-shell logout should sign out and send the next `/app` visit back to `/login?next=%2Fapp`
6. For a light authenticated API check, run this in the browser console while signed in:
   - `await fetch("/api/v1/report-runs/not-a-uuid").then(async (r) => ({ status: r.status, body: await r.json() }))`
   - expected: status `400`, body code `INVALID_RUN_ID`
   - this proves the request passed auth and reached route validation instead of returning `401`
7. For the strongest Stage 7 positive-path check, create or locate a dev/test `public.portfolios` row whose `user_id` equals the logged-in Supabase Auth user's UUID.
8. With that owned `portfolioId`, run this in the browser console while signed in:
   - `await fetch("/api/v1/report-runs", { method: "POST", headers: { "content-type": "application/json", "x-user-id": "11111111-1111-4111-8111-111111111111" }, body: JSON.stringify({ portfolioId: "<owned-portfolio-id>", reportingCurrency: "CAD" }) }).then(async (r) => ({ status: r.status, body: await r.json() }))`
   - expected: status `201`, response contains `runId` and status `QUEUED`
9. In Supabase Table Editor, inspect `public.report_runs` for that `runId`:
   - `user_id` should be the logged-in Supabase Auth user UUID
   - `user_id` should not be the spoofed `x-user-id` value
10. Use the returned `runId` for status and PDF-route checks:
    - `await fetch("/api/v1/report-runs/<runId>").then(async (r) => ({ status: r.status, body: await r.json() }))`
    - expected: status `200`, response includes the same `runId`
    - `await fetch("/api/v1/report-runs/<runId>/pdf").then(async (r) => ({ status: r.status, body: await r.json() }))`
    - expected before report completion: status `404`, body code `ARTIFACT_NOT_FOUND`

Manual verification result:

- On 2026-06-10, the user manually verified the Stage 6 route guard behavior and the light Stage 7 authenticated API behavior.
- Verified manually:
  - signed-out public routes render as expected
  - signed-out protected `/app` routes redirect to `/login?next=...`
  - signed-out report API returns `401 UNAUTHORIZED`
  - signed-in `/app` loads and remains authenticated on refresh
  - logout clears access to `/app`
  - signed-in invalid report-run route reaches validation and returns `400 INVALID_RUN_ID`, proving the request passed auth instead of returning `401`
- Deferred by user decision:
  - the strongest Stage 7 positive-path `POST /api/v1/report-runs` check with a real owned `portfolioId`
  - reason: portfolio creation UI is not ready yet and this can be validated naturally in the later portfolio UI phase
- This deferral is accepted for the current Phase 2 checkpoint because automated tests already cover authenticated session user ID usage, spoofed `x-user-id` header rejection, and report API ownership paths.

Pre-push verification on 2026-06-10:

- `git diff --check`: passed
- Focused Stage 6/7 tests passed:
  - `npm test -- --run src/proxy.test.ts src/server/auth/api-auth.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/api/v1/report-runs/[runId]/pdf/route.test.ts src/server/auth/supabase-proxy.test.ts`
  - result: 31 tests passed across 6 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 311 tests across 40 files
- `npm run build`: passed
- Build no longer reports the deprecated Next.js `middleware.ts` warning.

Stage 7 checkpoint outcome:

- Stage 6/7 user review and signoff completed with the owned-portfolio positive-path API check deferred as noted above.
- Implementation later continued into Stage 8 landing CTA wiring, Stage 9 verification, and Stage 10 documentation closeout.

## 13) Stage 8: Auth-Aware Navigation From Landing Page

Status: complete on 2026-06-10.

Goal:

- Connect the public landing page CTAs to the auth/app flow.

Deep-dive design decisions:

1. Keep `SecondActLanding` presentational and pass the report CTA destination in as a prop.
2. Let the server marketing page check authenticated session state with `getAuthenticatedUser()`.
3. Route unauthenticated report CTAs to `/login?next=%2Fapp`.
4. Route authenticated report CTAs directly to `/app`.
5. Mark the marketing home page as dynamic because it reads session/cookie-backed auth state.
6. Keep the sample PDF action separate from auth/app entry. Since a real sample PDF is not ready, link it to the existing report preview section as a safe placeholder.

Files changed:

- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/page.test.tsx`
- `src/components/landing/SecondActLanding.tsx`
- `src/components/landing/SecondActLanding.test.tsx`
- `src/components/landing/SecondActLanding.module.css`

Execution notes:

- Header `Get One-Time Report`, hero `Generate One-Time Report`, and final `Generate My Report` are now anchors instead of inert buttons.
- Unauthenticated destination: `/login?next=%2Fapp`.
- Authenticated destination: `/app`.
- `View Sample PDF` now links to `#sample-report-preview`.
- Existing footer placeholder links remain out of scope for Stage 8 because they are not report-start CTAs.

Focused verification:

- `npm test -- --run src/app/(marketing)/page.test.tsx src/components/landing/SecondActLanding.test.tsx`
- Result: passed, 4 tests across 2 files.

Coverage highlights:

- Server page test proves unauthenticated landing CTAs render with `/login?next=%2Fapp`.
- Server page test proves authenticated landing CTAs render with `/app`.
- Component test proves all three report CTAs use the provided destination.
- Component test proves the sample PDF CTA stays separate as an in-page preview placeholder.

Browser verification:

- Local dev server was already listening on port `3000`.
- In-app browser was signed out through `/auth/logout`.
- `http://127.0.0.1:3000/` rendered the landing page.
- Rendered report CTA state:
  - `Get One-Time Report` -> `/login?next=%2Fapp`
  - `Generate One-Time Report` -> `/login?next=%2Fapp`
  - `Generate My Report` -> `/login?next=%2Fapp`
  - report CTA button count: `0`
  - `View Sample PDF` -> `#sample-report-preview`
- Clicking `Generate One-Time Report` landed on `http://127.0.0.1:3000/login?next=%2Fapp`.
- Login page showed the email input and `Continue with Google`.
- Browser console warnings/errors: none.

Manual smoke checklist for Stage 8 and Stage 9:

1. Start local dev server with `npm run dev`.
2. Use an incognito browser session or visit `/auth/logout` first to force a signed-out state.
3. Visit `/`.
4. Confirm the landing page renders normally.
5. Confirm the three report-start CTAs are visually present:
   - header `Get One-Time Report`
   - hero `Generate One-Time Report`
   - final section `Generate My Report`
6. Click one report-start CTA while signed out.
7. Expected result:
   - browser lands on `/login?next=%2Fapp`
   - login page shows `Continue with Google`
   - login page shows the email-code form
8. Return to `/`.
9. Click `View Sample PDF`.
10. Expected result:
    - browser stays on the landing page
    - URL hash becomes `#sample-report-preview`
    - report preview section is shown
11. Sign in with Google or email OTP.
12. After successful sign-in, visit `/` again.
13. Click a report-start CTA while signed in.
14. Expected result:
    - browser goes to `/app`
    - authenticated app shell loads
15. Open browser dev tools console during the above checks.
16. Expected result:
    - no runtime console errors
    - no CSP/hydration errors
17. Run Stage 9 command gates if doing full manual signoff:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`

## 14) Stage 9: Test Coverage And Verification

Status: complete on 2026-06-10.

Goal:

- Protect auth and app-shell behavior before moving to portfolio UI/future phases.

Verification completed:

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 315 tests across 42 files
- `npm run build`: passed
- `git diff --check`: passed after implementation and documentation updates

Build notes:

- `/` is now dynamic because it reads authenticated session state for auth-aware landing CTAs.
- The deprecated Next.js `middleware.ts` warning remains resolved.

Stage 10 continuation point:

- Stage 10 documentation updates were completed after Stage 9 verification.
- Future phase work should not begin until this execution note and `phase-2-auth-app-shell-plan.md` are treated as the Phase 2 handoff source of truth.

## 15) Stage 10: Documentation Updates And Phase 2 Closeout

Status: complete on 2026-06-10.

Goal:

- Close the Phase 2 auth/app-shell work with durable documentation and an explicit acceptance-criteria audit.

Files updated:

- `chatbotNotes/phase-2-auth-app-shell-plan.md`
- `chatbotNotes/phase-2-auth-app-shell-execution.md`
- `chatbotNotes/supabase-auth-reference.md`
- `chatbotNotes/backend-knowledge-base.md`
- `chatbotNotes/production-readiness.md`

Closeout decisions:

1. `phase-2-auth-app-shell-plan.md` now serves as both the original plan and closeout checklist.
2. The acceptance criteria are marked with implementation evidence and explicit caveats.
3. `supabase-auth-reference.md` now describes Phase 2 auth as implemented, while preserving the historical Phase 1 scope boundary.
4. `backend-knowledge-base.md` now preserves the durable landing CTA routing rule.
5. `production-readiness.md` now reflects that `/app` exists for local smoke tests, while keeping OAuth branding/custom auth domain as production-only work.

Phase 2 closeout result:

- Engineering implementation: complete.
- Automated verification: complete.
- Browser smoke verification for signed-out landing CTAs: complete.
- Manual Google/email auth provider validation: complete from earlier Phase 2 stages.
- User-run Stage 8/9 manual landing CTA confirmation: optional final human checkpoint before push.
- Owned-portfolio positive-path report API manual check: deferred until a later portfolio UI/test-data phase.

Closeout verification rerun on 2026-06-10:

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 315 tests across 42 files
- `npm run build`: passed
- `git diff --check`: passed

Do not treat the remaining production readiness items as Phase 2 code blockers:

- Google OAuth production branding/custom auth domain
- custom SMTP for production OTP email
- production RLS hardening
- production worker/runtime hosting
- production market-data/model-provider choices
- cookie/privacy policy launch review
- removing `chatbotNotes` from Git before production launch if the team decides these notes should not ship in the repository
