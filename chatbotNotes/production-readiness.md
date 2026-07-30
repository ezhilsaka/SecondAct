# Production Readiness Notes

Last updated: 2026-07-30

This note captures the main items that must be addressed before moving the report-generation flow from local/dev execution to a production-ready setup.

## Production Setup Sequence

When creating a fresh production database/project, the expected setup flow is:

1. Create or select the production Supabase project.
2. Configure production database connection strings and secrets:
   - `DATABASE_URL`
   - `DIRECT_URL`, if used for migration/admin workflows
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` or newer publishable key equivalent
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_REPORTS_BUCKET`
3. Create the private Supabase Storage bucket for report PDFs.
   - The Prisma migrations do not create the bucket itself.
   - The bucket should remain private.
   - Allowed MIME type should include `application/pdf`.
4. Ensure the Graphile Worker schema is installed/available in the production database.
   - The queue stays in Supabase Postgres.
   - The worker process still runs outside Supabase in a production runtime.
5. Run Prisma migrations against production:

```bash
npm run db:migrate:deploy
```

The migrations should create:

- application enums
- application tables
- indexes
- foreign keys
- Prisma migration metadata
- app-table RLS baseline policies
- storage/object RLS baseline policy
- Graphile private-table hardening if the `graphile_worker` schema/tables already exist

Important migration-order caveat:

- The RLS migration safely skips Graphile private tables if the `graphile_worker` schema does not exist yet.
- If the Graphile Worker schema is created after the RLS baseline migration has already run, apply a follow-up Graphile hardening migration or rerun the equivalent Graphile-specific hardening SQL manually.
- Do not add public/client policies to Graphile Worker private tables. They are internal queue infrastructure, not Data API resources.

Production resources not created by Prisma migrations:

- Supabase project
- Supabase Auth provider configuration
- Supabase Storage bucket
- deployment platform environment variables
- production worker runtime
- production market-data provider/account
- LLM provider account/key
- payment provider/account

After setup, run a production smoke test:

1. Sign in through the deployed app.
2. Create or open a ready portfolio.
3. Generate a report.
4. Confirm the Vercel/API route creates and enqueues the report run.
5. Confirm the production worker picks up the queued job.
6. Confirm the report reaches `COMPLETED`.
7. Confirm the PDF opens through the signed URL flow.
8. Run Supabase security advisors and confirm no app-table `RLS Enabled No Policy` warnings remain.

## 1) Run the Graphile Worker in a Production Runtime

Current state:

- Vercel API routes can create report runs and enqueue jobs into Supabase Postgres.
- Supabase Postgres is the durable queue backend through `graphile-worker`.
- The actual worker process is currently run locally with `npm run worker:dev`.

Production requirement:

- Keep `graphile-worker` and Supabase Postgres as the queue design.
- Add a production runtime for the long-running worker process.
- The worker host must connect to the same Supabase database, read the same `graphile_worker` queue schema, and run the existing report pipeline.

Possible runtime options:

- Render
- Railway
- Fly.io
- Google Cloud Run
- VPS or other always-on Node worker host

Important note:

- This is not a queue redesign. The queue stays in Supabase Postgres. The missing production piece is only where the long-running worker process runs.

## 2) Replace or Productionize Market Data

Current state:

- The report pipeline currently uses the Python `yfinance` adapter.
- This is acceptable for local/dev validation.
- It is not the intended production-grade market-data source.

Production requirement:

- Replace `yfinance` with a production-grade market-data provider such as Alpha Vantage or another licensed/approved provider.
- Keep the existing `MarketDataProvider` boundary so the rest of the pipeline does not need to change.
- If the Python adapter remains temporarily, deploy it as a real service URL instead of relying on `localhost`.

## Model Readiness Note

Current state:

- Gemini works for the report narrative flow and successfully generated the report in testing.

Production improvement:

- Before production launch, evaluate and upgrade to a stronger production model if report quality, consistency, latency, or structured-output reliability needs improvement.
- Keep the current `NarrativeProvider` abstraction so the model/provider can be swapped without changing the rest of the report pipeline.

## Auth Branding Readiness Note

Current state:

- Google OAuth works through Supabase Auth during Phase 2 local validation.
- The Google consent screen currently shows the Supabase project auth domain, such as `vyodginprhfjvihqyfur.supabase.co`, instead of the Second Act product name.
- This is acceptable for local/dev testing but is not acceptable for production user trust.

Production requirement:

- Configure Google OAuth branding before production launch:
  - app name: `Second Act`
  - user support email
  - app logo, if available
  - app homepage
  - privacy policy URL
  - terms of service URL, if available
  - authorized domains
- Publish and/or verify the Google OAuth brand if Google requires it before showing the app name/logo to users.
- Consider a Supabase custom auth domain for production, such as `auth.<production-domain>`, so users see an auth domain clearly tied to the product instead of the raw Supabase project ref.

Important note:

- This is a production-readiness/provider configuration item, not a Phase 2 code blocker.
- After Phase 2 app-shell implementation, normal local auth smoke tests can use `/login?next=/app` or landing CTAs that resolve to `/login?next=%2Fapp`.
- If isolating provider configuration only, safe public redirects such as `/login?next=/` or `/login?next=/legal` can still be used.

## Supabase API Key Readiness Note

Current state:

- The browser auth client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The Supabase anon/public key is expected to be visible in browser bundles and network requests.
- Server-only privileged access uses `SUPABASE_SERVICE_ROLE_KEY` from server-side code.
- A local build scan on 2026-06-08 found no server-only secret values in `.next/static`.

Production requirement:

- Review Supabase API keys before launch and prefer the newer publishable/secret key model where available.
- Keep the publishable or anon key limited to browser-safe client operations.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, Supabase secret keys, database URLs, provider API keys, and internal service secrets backend-only.
- Do not pass service-role or secret keys through URLs, browser JavaScript, client logs, analytics events, or client-visible error messages.
- Confirm Row Level Security is enabled and reviewed for all user-owned tables that can be reached through Supabase client access.
- Confirm production environment variables are configured only in the deployment platform and are not committed to Git.

Important note:

- This is a production-readiness/security-hardening item, not a Phase 2 manual-test blocker.
- Browser network tools will still show public Supabase auth requests and public client keys; that is expected.
- The launch gate is that no privileged server-side secrets are exposed to client bundles, browser network traffic, or browser console logs.

## Cookie and Privacy Readiness Note

Current state:

- Second Act uses Supabase SSR/browser auth clients for login, logout, session refresh, and protected app access.
- This means the app uses necessary authentication/session cookies.
- Current repo review did not find analytics, ad pixels, heatmaps, marketing tags, or other intentional tracking-cookie integrations.

Production requirement:

- Document that Second Act uses necessary cookies for authentication and session management.
- Do not block necessary auth/session cookies behind optional consent, because login and protected app access depend on them.
- Before launch, add or update privacy/cookie policy copy to explain the necessary auth cookies in plain user-facing language.
- If future phases add analytics, advertising, heatmaps, marketing pixels, or non-essential preference cookies, add a real cookie consent/preferences system before production use.

Important note:

- A cookie banner/consent manager is not required for the current necessary-auth-cookie posture.
- This should be revisited if the product adds any non-essential client-side tracking, analytics, or marketing tooling.

## Internal Notes Repository Hygiene

Current state:

- `chatbotNotes/` is now intended to be tracked in Git during development because it contains important planning, execution, architecture, and production-readiness context.
- These notes are useful for project continuity, review, and phase handoff.

Production requirement:

- Before production launch, review whether `chatbotNotes/` should remain in the production repository branch.
- If the production deployment branch or release artifact should contain only runtime/source files, remove `chatbotNotes/` from that branch before launch.
- Confirm the deployment output does not ship internal planning notes, manual setup details, architecture commentary, or security checklist history.

Important note:

- This is repository hygiene for production release management, not a local development blocker.
- If `chatbotNotes/` remains in the main development branch, treat it as internal documentation and avoid storing secrets, private credentials, personal data, or provider tokens in these files.
