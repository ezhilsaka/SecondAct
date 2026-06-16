# Phase 2 Plan: Auth and App Shell

Last updated: 2026-06-10

## 1) Purpose

This document started as the implementation handoff plan for Phase 2 and now also serves as the closeout checklist for the Phase 2 auth/app-shell foundation.

Phase 1 proved the backend report pipeline:

`Portfolio -> Canonical Model -> Analysis Engine -> Narrative Engine -> PDF Generator`

Phase 2 turns the project from a landing page plus backend pipeline into the beginning of a real authenticated product experience.

The goal is not to build the full portfolio entry or report-generation UI yet. The goal is to create the secure app foundation that those later phases can safely use.

## 2) Current Starting Point

Current implementation state:

- Landing page exists.
- Phase 1 backend report pipeline is signed off.
- Supabase Postgres schema exists.
- `user_profiles` exists as the app-owned user profile table.
- Portfolio/report tables are already linked to `user_id`.
- Backend report APIs no longer use the temporary `X-User-Id` header in production route logic as of Stage 7.
- `src/proxy.ts` now contains the session-aware route guard as of Stage 6.
- The deprecated `src/middleware.ts` auth stub was removed during Stage 6.
- Stage 6 and light Stage 7 manual smoke verification passed on 2026-06-10; the owned-portfolio positive-path report API check is deferred until portfolio UI/test data is available.
- Stage 8 landing CTAs now route unauthenticated users to `/login?next=%2Fapp` and authenticated users to `/app`.
- Stage 9 verification passed on 2026-06-10:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Pre-implementation baseline verification also passed before Phase 2 changes began:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Supabase Auth decision is already locked:
  - Google login
  - email OTP/passwordless login
  - app-owned profile rows in `public.user_profiles`

Important existing files:

- `chatbotNotes/supabase-auth-reference.md`
- `chatbotNotes/phase-1-report-pipeline-build-execution.md`
- `chatbotNotes/backend-knowledge-base.md`
- `src/proxy.ts`
- `src/db/prisma/schema.prisma`
- `src/app/api/v1/report-runs/*`

## 3) Phase 2 Product Outcome

By the end of Phase 2, a user should be able to:

1. Land on the marketing page.
2. Click a CTA to sign in or start.
3. Sign in with Google or email OTP.
4. Have a persistent Supabase session.
5. Be redirected into a protected app dashboard.
6. Have a `user_profiles` row created or loaded automatically.
7. See a clean app shell with navigation for the future product areas.
8. Log out.
9. Be prevented from accessing protected app/API routes when unauthenticated.

## 4) Scope

### In Scope

- Supabase Auth integration for Next.js App Router.
- Google OAuth login.
- Email OTP/passwordless login.
- Auth callback route.
- Logout flow.
- Protected dashboard/app shell.
- Session-aware Next.js proxy/middleware route guard.
- Server-side authenticated user helper.
- Automatic `user_profiles` bootstrap/sync.
- Replace the `X-User-Id` placeholder in report-run API routes with authenticated Supabase user ID.
- Basic account/profile display in the app shell.
- Tests for auth helpers, profile bootstrap, protected-route behavior, and API auth behavior.

### Out Of Scope

- Portfolio create/edit/delete UI.
- Holdings entry UI.
- Report generation UI.
- Report history/library UI.
- Payment/checkout.
- Production Graphile worker hosting.
- Production market-data provider replacement.
- Full RLS policy hardening for every table unless it is needed for Phase 2 auth safety.
- A complete user settings page.

## 5) Architecture Decisions For Phase 2

### Auth Provider

Use Supabase Auth.

Supported methods:

- Google OAuth
- Email OTP/passwordless login

### Session Strategy

Use Supabase SSR-compatible cookie sessions so authenticated user state is available in:

- client components
- server components
- route handlers
- Next.js proxy/middleware

Recommended package:

- `@supabase/ssr`

Existing dependency:

- `@supabase/supabase-js` is already installed.

Original package status as of 2026-05-30:

- `@supabase/ssr` is not installed yet and must be added in Stage 1.

Current package status as of 2026-06-10:

- `@supabase/ssr` is installed and used by the browser, server, and proxy auth helpers.

### Next.js Auth Boundary

The project currently uses Next.js 16.x.

Decision:

- Implement the route-level auth guard using `src/proxy.ts`, the current Next.js file convention.
- Stage 6 migrated away from `src/middleware.ts`.
- `src/proxy.ts` is now the route-level first gate.

Important rule:

- Proxy/middleware is only the first gate.
- Protected server components, server actions, and route handlers must still verify authenticated user state close to the data access boundary.

### Build-Safe Runtime Initialization

Previous Phase 1 work already found that eager server env imports can break `next build`.

Rules for Phase 2:

- Supabase auth clients should be created through helper functions, not through eagerly initialized top-level runtime singletons.
- Browser auth helpers must only use public Supabase URL/key values.
- Server and proxy auth helpers must avoid importing service-role/admin clients.
- Route handlers that depend on server-only runtime config should keep using lazy or dynamic import patterns where needed.
- Do not introduce a top-level import chain that eagerly parses unrelated server env during static page collection.

### App Profile Strategy

Identity source of truth:

- `auth.users` in Supabase Auth

App profile source of truth:

- `public.user_profiles`

Important rule:

- `user_profiles.id` must match the Supabase Auth user ID.

Profile bootstrap should run after successful auth, either in the auth callback flow or on first protected app load.

### API Authorization Strategy

Phase 1 API routes currently trust `X-User-Id`.

Phase 2 must replace that with:

- read authenticated session server-side
- get `user.id` from Supabase Auth
- pass that authenticated `user.id` into existing service methods

Do not keep `X-User-Id` as a user-controllable production auth mechanism.

### Phase 2 Authorization Posture

Phase 2 authorization control is:

- Supabase Auth establishes identity.
- Next.js proxy is the first route-level guard.
- Server components, route handlers, and service boundaries must still verify authenticated user state.
- API-facing services must continue to receive `userId` explicitly as a parameter.
- Existing ownership checks in `ReportRunService` remain mandatory.
- Browser/client code must never use the service-role key or call privileged database operations directly.

RLS decision:

- Full table-by-table RLS hardening is not part of Phase 2 implementation scope.
- This is an explicit architecture exception for this phase, not a permanent production posture.
- Before public beta/production, create a security hardening phase that enables and verifies RLS for `user_profiles`, `portfolios`, `portfolio_holdings`, `report_runs`, `report_artifacts`, and `user_usage`.

### Phase 2 Data Flow

Auth flow:

```text
Browser
  -> /login
  -> Supabase Auth (Google OAuth or email OTP)
  -> /auth/callback
  -> exchange code/session
  -> bootstrap user_profiles + user_usage
  -> /app
```

Protected app flow:

```text
Browser request to /app
  -> Next.js proxy session refresh/check
  -> app layout/server component require authenticated user
  -> profile bootstrap/load
  -> render app shell with profile data
```

Protected API flow:

```text
Browser/API client request
  -> Next.js proxy first gate
  -> route handler requireAuthenticatedUser()
  -> ReportRunService(userId, ...)
  -> Prisma ownership-scoped query
  -> JSON response
```

### Abuse Controls And Rate Limits

Phase 2 should avoid overbuilding rate limiting, but it should not ignore abuse paths.

Minimum Phase 2 posture:

- Rely on Supabase Auth provider-side protections for OAuth and email OTP during local/dev validation.
- Do not log OTP codes, auth tokens, refresh tokens, or full OAuth payloads.
- Keep report APIs authenticated and ownership-scoped.
- Return generic auth errors to the user.

Pre-public-launch follow-up:

- Review OTP request throttling, bot protection, and abuse controls.
- Consider app-side rate limiting or Vercel/WAF rules for `/login`, `/auth/*`, and `/api/v1/report-runs/*`.
- Consider CAPTCHA or additional friction only if real abuse signals appear.

### Observability For Auth

Phase 2 should add token-safe structured logs for auth-critical server-side paths.

Log events worth capturing:

- auth callback success/failure
- logout success/failure
- profile bootstrap created existing/missing profile
- profile bootstrap failure
- protected API unauthenticated request

Logging rules:

- Never log OTP codes, access tokens, refresh tokens, provider tokens, or raw auth cookies.
- Prefer stable IDs and event names over raw payload dumps.
- Include `userId` only after the user is authenticated.

### Database Migration Expectation

No Prisma schema migration is expected for Phase 2.

Reason:

- `user_profiles` already exists.
- `user_usage` already exists.
- Portfolio and report tables are already linked to `user_id`.

If implementation reveals a blocking schema issue, document the reason before adding a migration.

## 6) Manual Supabase Work Required

These tasks must be done manually in the Supabase dashboard and Google Cloud console before or during implementation.

### 6.0 Implementation-Start Prerequisites

Before full end-to-end auth validation, confirm:

1. Supabase Auth URL configuration is ready for local development.
2. Google OAuth provider is enabled and configured.
3. Email provider/OTP behavior is enabled and the email template supports the target UX.
4. Local `.env` has usable Supabase values.
5. `@supabase/ssr` has been installed.

Implementation can begin before all dashboard work is complete, but manual validation cannot be signed off until the Supabase/Google prerequisites are done.

### 6.1 Supabase Auth URL Configuration

In Supabase Dashboard:

1. Go to Auth settings / URL Configuration.
2. Set the Site URL.
   - Local: `http://localhost:3000`
   - Production later: real production domain
3. Add redirect URLs for local development:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`
4. Add redirect URLs for deployed environments when needed:
   - Vercel production URL
   - Vercel preview URL pattern if preview auth testing is needed
5. In production, prefer exact redirect URLs over broad wildcard patterns.

Why this matters:

- Google OAuth and email OTP redirect flows only work for allowed URLs.
- Email confirmation, magic link, and passwordless flows use this configuration.

### 6.2 Google OAuth Provider Setup

In Google Cloud Console:

1. Create or select a Google Cloud project.
2. Configure OAuth consent screen.
3. Create an OAuth Client ID.
4. Choose Web application.
5. Add Authorized JavaScript origins:
   - `http://localhost:3000`
   - production domain later
6. Add Authorized redirect URI from the Supabase Google provider page.
   - This is the Supabase Auth callback URL, not the app callback route.
7. Copy the Google Client ID and Client Secret.

In Supabase Dashboard:

1. Go to Auth Providers.
2. Enable Google.
3. Paste the Google Client ID and Client Secret.
4. Save provider settings.
5. Test Google login in local dev.

### 6.3 Email OTP / Passwordless Setup

In Supabase Dashboard:

1. Ensure Email provider is enabled.
2. Decide whether Phase 2 uses:
   - OTP code entry, recommended for the product experience, or
   - magic link fallback, acceptable for early development
3. If using OTP code entry, configure all relevant email templates to include the OTP token clearly.
   - Existing/returning passwordless users can use the `Magic link or OTP` template.
   - First-time passwordless users can receive the `Confirm sign up` template.
   - Both templates must show `{{ .Token }}` if the app is asking the user to enter a six-digit code.
4. Confirm the redirect URL in the template points back to the app callback route when a link is used.
5. For development, Supabase-hosted email can be used.
6. For production, plan custom SMTP setup before launch.

Recommended Phase 2 behavior:

- Use email OTP code entry as the target UX.
- Keep magic-link compatibility as a fallback if Supabase template configuration takes longer.
- Do not leave first-time users on the default link-only `Confirm sign up` template while the login UI says `Code sent`.

### 6.4 Environment Variables

Confirm local `.env` has:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Confirm Vercel has equivalent environment variables when deployed.

Do not expose:

- `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.

Key naming note:

- Supabase docs increasingly refer to browser-safe keys as publishable keys.
- The current project can keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Phase 2 compatibility.
- If the Supabase project exposes a newer publishable key, map it into the existing env name unless a deliberate env rename is scheduled.

### 6.5 Optional RLS Preparation

Phase 2 should review RLS posture, but avoid over-expanding scope.

Minimum expectation:

- Server-side API routes must enforce authenticated ownership checks.
- Service-role operations remain server-only.
- Full table-by-table RLS hardening is explicitly deferred unless the user chooses to expand Phase 2 scope.

Later production-hardening expectation:

- Add RLS policies for user-owned tables.
- Verify policies for `user_profiles`, `portfolios`, `portfolio_holdings`, `report_runs`, `report_artifacts`, and `user_usage`.

## 7) Implementation Stages

## Stage 0: Baseline Audit

Goal:

- Confirm starting point before code changes.

Tasks:

- Verify working tree is clean.
- Re-run baseline tests.
- Review `src/middleware.ts` stub.
- Note the current Next.js 16 build warning that `middleware.ts` should migrate to `proxy.ts`.
- Review report API routes that currently use `X-User-Id`.
- Confirm current env variable names.

Expected verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`

## Stage 1: Install Auth Runtime Dependencies

Goal:

- Add the dependency needed for Supabase cookie-based SSR auth.

Tasks:

- Install `@supabase/ssr`.
- Keep `@supabase/supabase-js`.
- Update `.env.example` if new auth-specific env guidance is needed.
- Preserve the current `NEXT_PUBLIC_SUPABASE_ANON_KEY` env name unless a deliberate key-name migration is made.

Expected files:

- `package.json`
- `package-lock.json`
- `.env.example`

Verification:

- install succeeds
- typecheck remains clean

## Stage 2: Create Supabase Client Helpers

Goal:

- Centralize browser, server, and proxy Supabase client creation.

Recommended structure:

- `src/server/auth/supabase-server.ts`
- `src/server/auth/supabase-proxy.ts`
- `src/lib/supabase/browser.ts`

Responsibilities:

- Browser client uses public URL and anon key only.
- Server client uses cookie-based session access.
- Proxy client reads/writes cookies correctly so sessions refresh.
- Admin/service-role client remains separate and server-only.
- Helper creation is build-safe and does not eagerly initialize server-only SDKs at module import time.
- Server-side auth helper should provide a small authenticated-user function for route handlers and app shell loading.

Important rule:

- Do not reuse the existing Supabase admin storage client for user auth/session reads.
- Do not import `supabaseAdmin` into auth/session helpers.

Verification:

- unit tests around helper creation where practical
- typecheck

## Stage 3: Auth Callback, Login, OTP, and Logout

Goal:

- Implement the basic sign-in/sign-out flows.

Routes/pages to add:

- `/login`
- `/auth/callback`
- `/auth/logout` or server action-based logout

Login UX:

- Continue with Google
- Continue with Email
- OTP code entry state
- clear loading and error states

Callback behavior:

- exchange Supabase auth code for session
- preserve safe `next` redirect param
- reject external redirect targets
- redirect authenticated users to `/app`

Logout behavior:

- sign out from Supabase
- clear session cookies
- redirect to `/`

Security notes:

- `next` redirect must be relative-only.
- Do not log OTP codes or auth tokens.
- Keep credential/account auth errors user-friendly and generic.
- Provider throttle/rate-limit errors may use a clear wait-and-retry message because they do not reveal account existence and reduce manual-test confusion.
- Avoid custom auth throttling in Phase 2 unless needed; rely on Supabase/provider controls for local validation and track app-side rate limiting as a pre-public-launch follow-up.

Verification:

- login page renders
- Google button calls OAuth flow
- email OTP request works
- OTP verification works
- callback creates session
- logout clears session

## Stage 4: Profile Bootstrap

Goal:

- Ensure each authenticated user has an app-owned `user_profiles` row.

Tasks:

- Add server-side profile bootstrap service.
- On first login/protected app access:
  - read authenticated Supabase user
  - derive email
  - create `user_profiles` row if missing
  - create `user_usage` row if missing
  - preserve existing profile if present
- Generate `investor_handle`.
- Add token-safe structured logs for profile created/loaded/failure outcomes.

Recommended handle strategy for Phase 2:

- deterministic-ish readable base from email prefix
- normalize to lowercase alphanumeric plus hyphen/underscore
- append short random suffix on collision
- keep it simple; handle branding can be refined later

Profile field approach:

- If first/last name are available from Google metadata, use them.
- For email OTP users, do not expose first/last name fields on the initial login form.
- After OTP verification, route authenticated users without a profile to the login-page profile step (`/login?step=profile`) to collect first and last name inside the same visual login shell.
- Keep `/profile/setup` only as a compatibility redirect into the login-page profile step.
- This avoids checking whether an email is first-time or returning before authentication, which would risk email/account enumeration.
- Keep safe placeholders out of normal profile creation; require profile completion when metadata is missing.

Potential schema concern:

- `first_name` and `last_name` are currently required.
- Phase 2 must populate them from provider/user metadata or use safe fallback defaults.

Recommendation:

- Collect first/last name for first-time email OTP users after OTP verification to avoid deriving names from the email local part.
- Defer richer profile-editing/onboarding UX to a later product phase.

Verification:

- first Google login creates profile
- first email login creates profile
- repeat login does not duplicate profile
- `user_usage` exists for the user
- collision handling for `investor_handle` is tested and treated as required coverage

## Stage 5: Protected App Shell

Goal:

- Create the authenticated app foundation.

Routes/layouts to add:

- `/app`
- `/app/layout`
- `/app/account` or `/app/profile` placeholder

App shell should include:

- Second Act brand
- user email/name area
- logout action
- navigation placeholders:
  - Dashboard
  - Portfolios
  - Reports
  - Account
- empty-state card explaining the next action

Recommended `/app` content for Phase 2:

- Welcome message
- Product status card: portfolio setup coming next
- Report pipeline status card: backend ready
- Clear CTA placeholder for Phase 3: `Create Portfolio`

Design direction:

- Preserve landing-page brand language, but make the app feel calmer and utility-oriented.
- Avoid generic SaaS shell styling.
- Keep accessibility basics: semantic nav, visible focus, proper form labels.

Verification:

- unauthenticated user cannot access `/app`
- authenticated user can access `/app`
- app shell displays authenticated profile data
- logout works from app shell

## Stage 6: Replace Middleware Stub With Real Session Guard

Goal:

- Remove the permissive auth stub before protected routes become real.

Tasks:

- Migrate the guard from `src/middleware.ts` to `src/proxy.ts` for Next.js 16.
- Remove or retire the permissive `src/middleware.ts` stub after the proxy guard is implemented.
- Keep explicit public allow-list:
  - `/`
  - `/legal`
  - `/login`
  - `/auth/callback`
  - `/auth/logout`
  - `/api/health`
  - static/Next internals
- Treat `/app/**` as protected.
- Treat Phase 1 report APIs as protected.
- Browser unauthenticated requests redirect to `/login?next=...`.
- API unauthenticated requests return JSON 401.

Important:

- Proxy/middleware is a first gate only.
- Route handlers must still verify the authenticated user server-side.
- Follow the Supabase SSR cookie refresh pattern so existing sessions stay fresh.
- Keep API 401 payloads consistent with the route-handler error format where practical.

Verification:

- proxy/middleware tests for public routes
- proxy/middleware tests for protected browser routes
- proxy/middleware tests for protected API routes
- session refresh behavior does not break logged-in users

## Stage 7: Replace `X-User-Id` In Report APIs

Goal:

- Make existing report API routes use real authenticated user identity.

Routes to update:

- `POST /api/v1/report-runs`
- `GET /api/v1/report-runs/:runId`
- `GET /api/v1/report-runs/:runId/pdf`

Tasks:

- Add server-side helper, for example `requireAuthenticatedUser()`.
- Helper returns authenticated Supabase user ID.
- Route handlers pass authenticated user ID to `ReportRunService`.
- Remove `X-User-Id` requirement from production route logic.
- Preserve dynamic/lazy imports for report-run service where needed to avoid build-time env parsing failures.
- Update error response semantics:
  - missing/invalid session => `401 UNAUTHORIZED`
  - valid session but resource not owned by user => existing not-found behavior

Testing impact:

- Update route tests to mock authenticated session helper instead of sending `X-User-Id`.
- Keep coverage for unauthenticated requests.

Compatibility note:

- Postman/manual dev tests should now authenticate normally or use a dedicated dev-only helper if explicitly added later.
- Do not leave spoofable user headers as the main path.

## Stage 8: Auth-Aware Navigation From Landing Page

Goal:

- Connect the public landing page to the auth/app flow.

Tasks:

- Update landing-page CTA buttons to link to `/login` or `/app`.
- If user is already authenticated, CTA can send them to `/app`.
- Add sign-in link in header if appropriate.
- Keep sample PDF CTA behavior separate; if sample PDF is not ready, leave it as a safe placeholder.

Recommended CTA mapping:

- `Generate One-Time Report` -> `/login?next=%2Fapp` when signed out, `/app` when signed in
- `Get One-Time Report` -> `/login?next=%2Fapp` when signed out, `/app` when signed in
- `Generate My Report` -> `/login?next=%2Fapp` when signed out, `/app` when signed in

Verification:

- CTAs no longer dead-end as inert buttons.
- unauthenticated CTA lands on login.
- authenticated user can reach `/app`.

## Stage 9: Test Coverage And Verification

Goal:

- Protect auth and app shell behavior before moving to portfolio UI.

Test areas:

- Supabase auth helper behavior
- profile bootstrap service
- proxy/middleware route protection
- login form rendering and validation
- logout action/route
- report API route auth replacement
- safe redirect handling
- app shell rendering
- build-safety regression around auth helper imports where practical
- token-safe auth/profile observability where practical

Recommended commands:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual validation:

- Google login local flow
- email OTP local flow
- session persistence after refresh
- logout
- protected route redirect
- profile row creation in Supabase
- `user_usage` row creation in Supabase
- report API returns 401 without session

## Stage 10: Documentation Updates

Goal:

- Keep head-office context current.

Status as of 2026-06-10:

- Complete as the Phase 2 closeout documentation stage.

Documents updated or maintained:

- `chatbotNotes/phase-2-auth-app-shell-execution.md`
- `chatbotNotes/supabase-auth-reference.md`
- `chatbotNotes/backend-knowledge-base.md`
- `chatbotNotes/production-readiness.md`

Execution-memory document:

- `chatbotNotes/phase-2-auth-app-shell-execution.md`

Do not overload the Phase 1 execution file with Phase 2 details.

## 8) Acceptance Criteria

Phase 2 is complete when:

1. Google login works locally.
2. Email OTP/passwordless login works locally.
3. Auth callback exchanges code/session correctly.
4. Logout clears the session and redirects safely.
5. `/app` is protected from unauthenticated users.
6. Authenticated users can load `/app`.
7. `user_profiles` row is created or loaded for authenticated users.
8. `user_usage` row exists for authenticated users.
9. Existing report API routes no longer rely on `X-User-Id`.
10. Existing report API routes use authenticated Supabase user ID.
11. Unauthenticated API requests return 401.
12. Landing page CTAs route into the auth/app flow.
13. Next.js 16 proxy/middleware deprecation is resolved or explicitly documented.
14. No Phase 2 schema migration is added unless a documented blocker requires it.
15. Token-safe auth/profile observability is implemented for critical server-side paths.
16. Tests, typecheck, lint, and build pass.

### Acceptance Criteria Status As Of 2026-06-10

| # | Status | Evidence / caveat |
| --- | --- | --- |
| 1 | Complete | Google login was manually validated during Phase 2 local provider testing. |
| 2 | Complete | Email OTP was manually validated after Supabase templates were updated to expose `{{ .Token }}`. |
| 3 | Complete | Auth callback exchanges session code and is covered by focused callback tests plus manual auth-provider flows. |
| 4 | Complete | Logout route signs out through Supabase, redirects safely, and was manually smoke-tested from the app shell. |
| 5 | Complete | `/app` is protected at `src/proxy.ts` and the app layout boundary. |
| 6 | Complete | Authenticated users can load `/app` and see the protected app shell. |
| 7 | Complete | `user_profiles` bootstrap is implemented, idempotent, and avoids placeholder names for first-time email users. |
| 8 | Complete | `user_usage` bootstrap is implemented and handles concurrent creation races. |
| 9 | Complete | Report API route logic no longer uses `X-User-Id` as the production auth mechanism. |
| 10 | Complete | Report API route logic passes the authenticated Supabase user ID into report services. The full owned-portfolio positive-path manual API check remains deferred until portfolio UI/test data exists. |
| 11 | Complete | Unauthenticated protected API requests return `401 UNAUTHORIZED`. |
| 12 | Complete | Landing report CTAs are auth-aware. Automated tests and in-app browser smoke verification passed; user manual Stage 8/9 checklist is available for final human confirmation. |
| 13 | Complete | Deprecated `src/middleware.ts` was removed and replaced by `src/proxy.ts`; build no longer reports the middleware deprecation warning. |
| 14 | Complete | No Phase 2 Prisma schema migration was added. |
| 15 | Complete | Critical server auth/profile paths use structured operational errors without logging tokens, OTP codes, session cookies, or Supabase secrets. |
| 16 | Complete | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check` passed on 2026-06-10. |

Phase 2 engineering closeout is complete with two explicit caveats:

1. Final user/manual signoff for Stage 8/9 landing CTA behavior is still a human checkpoint if the user wants to run it before pushing.
2. The strong owned-portfolio positive-path report API smoke check is deferred until portfolio UI or reliable owned portfolio test data exists in a later phase.

Neither caveat requires more Phase 2 code before moving on.

## 9) Final Handoff For The Next Phase

Before starting future portfolio/report UI work:

1. Read this document.
2. Read `chatbotNotes/phase-2-auth-app-shell-execution.md`.
3. Read `chatbotNotes/supabase-auth-reference.md`.
4. Confirm `src/proxy.ts` remains the request-level route guard.
5. Confirm `src/middleware.ts` remains removed.
6. Keep protected route-handler checks even though proxy protection exists.
7. Preserve authenticated Supabase user ID as the ownership source for report and portfolio APIs.
8. Use the landing report CTA behavior as the public-to-app entry rule:
   - signed out -> `/login?next=%2Fapp`
   - signed in -> `/app`
9. Do not reintroduce `X-User-Id` as a production auth path.
10. Carry production-readiness items forward separately from local Phase 2 completion.

## 10) Migration And Rollback Guidance

Expected migration posture:

- No database schema migration is expected for Phase 2.
- `@supabase/ssr` is the only required runtime dependency addition.
- `src/middleware.ts` should be replaced by `src/proxy.ts` for the route-level guard.
- API routes should preserve the existing service-layer contract shape by passing authenticated `userId` into `ReportRunService`.

Deployment/implementation guardrails:

1. Keep `/api/health` public throughout implementation.
2. Implement auth helpers before replacing API auth behavior.
3. Keep route-handler auth checks even after proxy protection is in place.
4. Run `npm run build` after proxy/auth helper work to catch build-time env import regressions.
5. Do not add schema migrations unless a specific blocker is found and documented.

Rollback guidance:

- If the proxy guard blocks legitimate local auth validation, temporarily narrow the proxy matcher/guard while keeping server-side route-handler auth checks in place.
- If report API auth migration breaks, restore the last known working route-handler implementation while keeping `X-User-Id` out of production-bound logic.
- If profile bootstrap creates incorrect rows, stop automatic bootstrap first, inspect the affected rows manually, and only then rerun with corrected logic.
- Since no schema migration is expected, rollback should normally be a code rollback plus Supabase Auth dashboard setting review.

## 11) Risks And Watchpoints

### Required first/last names

`user_profiles.first_name` and `user_profiles.last_name` are required.

Risk:

- Email OTP users may not provide names during login.

Mitigation:

- Require profile completion after OTP verification when an authenticated user has no profile names.
- Render profile completion inside the login shell rather than a visually separate setup page.
- Avoid pre-auth first-time checks on the login page because they can leak whether an email has an account.

### Proxy/middleware cookie handling

Risk:

- Incorrect proxy/middleware cookie handling can cause users to appear logged out after refresh.

Mitigation:

- Follow Supabase SSR proxy/middleware pattern.
- Test refresh/session persistence.

### Build-time env import regressions

Risk:

- Auth helper imports could accidentally evaluate server-only env or service SDKs during `next build`.

Mitigation:

- Keep Supabase auth clients behind small helper functions.
- Keep privileged service-role clients separate from user auth/session helpers.
- Preserve dynamic imports in route handlers where existing build-safety patterns require them.
- Run `npm run build` before signoff.

### Redirect safety

Risk:

- Unsafe `next` handling can create open redirects.

Mitigation:

- Only allow relative `next` values beginning with `/`.
- Fallback to `/app`.

### API auth migration

Risk:

- Tests and Postman habits may still depend on `X-User-Id`.

Mitigation:

- Update tests and docs.
- If a dev-only bypass is ever needed, make it explicit, environment-gated, and never enabled in production.

### Auth abuse controls

Risk:

- Email OTP and auth endpoints can be abused if exposed publicly without throttling.

Mitigation:

- Use Supabase/provider-side controls for Phase 2 validation.
- Keep user-facing errors generic.
- Track app-side rate limiting, WAF rules, or CAPTCHA as a pre-public-launch security task.

### RLS scope creep

Risk:

- Trying to fully harden RLS for every table may expand Phase 2 too much.

Mitigation:

- Keep Phase 2 server-side authorization strong.
- Track full RLS hardening as a production/security phase unless selected explicitly.

### Next.js proxy migration

Risk:

- Leaving the auth guard in deprecated `src/middleware.ts` creates ongoing build warnings and could confuse later agents.

Mitigation:

- Migrate to `src/proxy.ts` in Stage 6.
- If `middleware.ts` is intentionally retained, document the reason in the Phase 2 execution notes.

### Accidental schema churn

Risk:

- Phase 2 could drift into unnecessary schema changes even though existing auth-ready tables are sufficient.

Mitigation:

- Treat "no schema migration expected" as the default.
- Require a documented blocker before any Prisma migration is added.

## 12) References

Official Supabase docs to use during implementation:

- Supabase Auth overview: https://supabase.com/docs/guides/auth
- Supabase server-side auth: https://supabase.com/docs/guides/auth/server-side
- Supabase Next.js server-side auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Google login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Passwordless email login: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Email templates: https://supabase.com/docs/guides/auth/auth-email-templates

Official Next.js docs to use during implementation:

- Next.js Proxy file convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication
