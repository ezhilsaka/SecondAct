# Backend Knowledge Base

Last updated: 2026-06-06

## 1) Purpose

This file is the clarification-memory companion to the backend build thread.

It is different from the execution document:

- the execution document records what we implemented, verified, and completed
- this knowledge base records important clarifications, architectural explanations, tradeoffs, and answers to recurring questions

If the original backend conversation is lost, this file should help explain **why** certain decisions were made, not just **what** was done.

## 2) Related Reference Files

- [phase-1-report-pipeline-plan-v1.md](/Users/ezhilpandiyansk/Documents/Ezhil/Projects/SecondAct/chatbotNotes/phase-1-report-pipeline-plan-v1.md)
- [phase-1-report-pipeline-build-execution.md](/Users/ezhilpandiyansk/Documents/Ezhil/Projects/SecondAct/chatbotNotes/phase-1-report-pipeline-build-execution.md)
- [supabase-auth-reference.md](/Users/ezhilpandiyansk/Documents/Ezhil/Projects/SecondAct/chatbotNotes/supabase-auth-reference.md)
- [testing-framework-reference.md](/Users/ezhilpandiyansk/Documents/Ezhil/Projects/SecondAct/chatbotNotes/testing-framework-reference.md)

## 3) Scope Clarifications

### Q: What is the Phase 1 backend scope right now?

A:

- The current Phase 1 scope is limited to:
  - `Canonical Model -> Analysis Engine -> Narrative Engine -> PDF Generator`
- The immediate goal is: given a portfolio, produce a PDF report.
- Payment, full auth UX, save/email flows, import UX, and other surrounding product features are intentionally deferred.

### Q: Why are we not building everything around the PDF flow now?

A:

- The PDF output is the clearest proof that the core product logic works.
- Once the report quality is visible, later layers such as payment, delivery, and account flows can be added on top with more confidence.

## 4) Architecture Clarifications

### Q: Are we building full microservices from day 1?

A:

- No.
- The architecture is **API-first and microservice-ready**, but not fully distributed on day 1.
- The current approach is best described as:
  - modular monolith for the main backend
  - separate worker path
  - separate Python market-data service

This keeps delivery practical while preserving clean service boundaries for later extraction.

### Q: Will the backend we are building now connect cleanly with future frontend, payment, save, and email layers?

A:

- Yes.
- The architecture was intentionally designed to support later layers through:
  - stable API contracts
  - user-linked data ownership
  - queue-based report processing
  - artifact storage for generated PDFs
  - future-compatible status and payment fields
  - event-hook-style thinking for later `report.completed` style behavior

### Q: If we later enhance the report and need more market data, is the current design flexible enough?

A:

- Yes.
- The design separates:
  - market-data adapter contract
  - canonical model
  - analysis
  - narrative
  - PDF rendering

So richer market data can be introduced by extending the market-data contract in controlled, backward-compatible ways, instead of rewriting the whole pipeline.

## 5) Database And Infrastructure Clarifications

### Q: Why was Supabase recommended over Neon?

A:

- Supabase was recommended because it gives:
  - Postgres
  - Storage
  - Auth
  - RLS support

in one platform, which matches the project’s user-linked portfolios and report artifacts well.

Neon is strong as a pure Postgres option, but it would require more surrounding services.

### Q: Is there a truly production-grade free database option?

A:

- No.
- Free tiers are fine for development and early validation, but not something to rely on as a final production posture.

### Q: Do we need a paid MQ or job queue service now?

A:

- No.
- The current recommendation is to use a Postgres-backed queue with `graphile-worker`.
- That keeps the architecture close to production without introducing a separate paid MQ too early.

### Q: Why must everything be user-linked?

A:

- Because pricing, entitlements, access control, report ownership, and future billing all depend on being able to answer:
  - which user owns this portfolio
  - which user generated this report
  - how many reports has this user generated

That is why `user_id` is present across the key portfolio/report tables and why `user_usage` exists.

## 6) Portfolio And Data Model Clarifications

### Q: Why does `portfolios` have `base_currency`?

A:

- We initially considered omitting it, but later clarified that the portfolio needs a stable reporting currency preference.
- That base currency belongs at the portfolio level because it is a user-defined setting, not a transient report artifact.

### Q: Why does `report_runs` also have `reporting_currency` if the portfolio already has `base_currency`?

A:

- `report_runs.reporting_currency` is a frozen snapshot copy of the portfolio’s base currency at report-generation time.
- This protects auditability.
- If a user changes the portfolio base currency later, old reports still remember what currency they were generated in.

### Q: Why are computed values like total value and total returns not stored on the `portfolios` table?

A:

- Because they are derived and time-sensitive.
- They change with:
  - market prices
  - FX rates
  - valuation timestamp

Storing them directly on `portfolios` would make them stale quickly.

The correct home for them in Phase 1 is:

- canonical snapshot
- analysis output
- later, if needed, a dedicated cached snapshot table

### Q: Why do we persist the canonical snapshot JSON to `report_runs`?

A:

- Because the report pipeline needs an audit-safe frozen input for each report run.
- The canonical snapshot captures:
  - the portfolio holdings used for the run
  - the normalized market data used for the run
  - FX context
  - derived holding-level totals at the time of generation

Persisting it on `report_runs` is useful for several reasons:

- reproducibility:
  - later portfolio edits or later market moves should not change what an old report was based on
- debugging:
  - if analysis or narrative looks wrong later, the exact snapshot can be inspected
- stage decoupling:
  - analysis, narrative, and PDF steps can reuse the same frozen snapshot without refetching market data
- retry safety:
  - later steps can be retried without rebuilding the upstream market-data context every time
- audit/compliance:
  - there is a durable record of what the report actually used as its source-of-truth input

So the canonical snapshot is not just temporary working memory.
It is the frozen run-level input artifact for the rest of the report pipeline.

### Q: What is the relationship between portfolios and `report_runs`?

A:

- A portfolio is a long-lived user-owned object that can exist without any report being generated.
- A `report_run` is a specific report-generation event for a portfolio.

That means:

- one user can have many portfolios
- one portfolio can have many report runs over time
- each `report_run` belongs to exactly one portfolio

In practical product terms:

- the user can create and edit portfolios independently
- each portfolio can later have its own `Generate report` action
- clicking `Generate report` should create a new `report_run` tied to that portfolio

This is useful because it preserves:

- report history
- reproducibility
- retryability
- pricing/usage tracking

So `reportRunId` as a Step 6 entrypoint makes sense because Step 6 is building the canonical snapshot for one specific report-generation event, not for the portfolio in the abstract.

### Q: Why is there only one holding row per ticker in a portfolio?

A:

- The MVP uses an **aggregated holding model**, not a tax-lot model.
- If a user bought `AAPL` multiple times, Phase 1 stores:
  - one consolidated row
  - total quantity
  - weighted average cost

This keeps the portfolio model simpler and aligns with the current report-first MVP.

### Q: Should duplicate ticker entries be blocked or aggregated?

A:

- They should be aggregated in code before save.
- The DB still enforces uniqueness on `(portfolio_id, ticker)` as the integrity backstop.

## 7) Auth Clarifications

### Q: What does “Supabase Auth” mean here?

A:

- It means using Supabase’s built-in identity system for:
  - Google login
  - email-based OTP / passwordless login

It does **not** mean removing those login methods.

The split is:

- Supabase Auth handles identity/session/authentication
- our app-owned `user_profiles` table stores product-specific metadata:
  - first name
  - last name
  - email
  - `investor_handle`

### Q: Is full auth implementation part of Phase 1 backend pipeline work?

A:

- No.
- The schema is auth-ready, but full auth implementation is intentionally deferred.
- A separate auth reference note was created for later implementation work.

### Q: Is Supabase Auth available on the free tier?

A:

- Yes, for development usage it is available and practical.
- One caveat is email delivery: for real production-grade email OTP flows, custom SMTP will likely be needed later.

### Q: Why does Phase 2 show both Google and email login options?

A:

- The Phase 2 plan explicitly included both:
  - Google OAuth
  - email OTP / passwordless auth
- These are two authentication methods, not two different account types.
- A user can authenticate with whichever method is easier for them.
- The product still has one app account identity through Supabase Auth.
- The app-owned `user_profiles` row is what connects that Supabase identity to Second Act product metadata.

### Q: Do login and sign-up need to be separate flows?

A:

- Not necessarily for the current Phase 2 product.
- Recommended Phase 2 UX is a single entry surface, such as `Sign in` or `Continue`, where the same Google/email actions work for both new and returning users.
- Supabase differentiates new vs returning users at the identity layer:
  - if the identity already exists, Supabase creates a session for the returning user
  - if signups are allowed and the identity does not exist, Supabase creates a new auth user
- The Second Act app should differentiate first-time vs returning users during profile bootstrap:
  - no `public.user_profiles` row for the authenticated Supabase user ID means first-time app setup
  - existing `public.user_profiles` row means returning user
- Marketing CTAs can say `Get started`, `Generate report`, or `Continue`, but they can route to the same `/login` page.
- A separate `Sign up` page should only be added if the product later needs a meaningfully different onboarding, invitation, waitlist, payment-gated signup, or account-creation consent flow.

### Q: Who sends the email OTP and where is the email template designed?

A:

- The app does not send the OTP email directly.
- The app triggers the OTP by calling Supabase Auth from the browser client:
  - `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser } })`
- Supabase Auth then:
  - generates the OTP
  - applies the configured email auth template
  - sends the email through Supabase-managed email delivery in development, or custom SMTP later if configured
- The app verifies the user-entered code by calling:
  - `supabase.auth.verifyOtp({ email, token, type: "email" })`
- The email template is configured in Supabase Dashboard under Auth Email Templates, not in the application code for Phase 2.
- To send an OTP code instead of only a magic link, the relevant Supabase email template must include the `{{ .Token }}` variable.
- Phase 2 should add an explicit manual validation checklist before final signoff:
  - email template contains clear Second Act copy
  - email template exposes the six-digit OTP token
  - optional magic-link/token-hash fallback still routes safely to `/auth/callback`
  - OTP expiration/rate-limit settings are acceptable for local validation
  - custom SMTP is tracked as a pre-production requirement, not a Phase 2 code blocker

### Q: What counts as manual email OTP template signoff?

A:

- A read-only Supabase Dashboard check on 2026-06-06 confirmed:
  - the project is using Supabase's built-in email service
  - Supabase warns the built-in email service has rate limits and is not intended for production apps
  - the `Magic link or OTP` template detail page is available
  - the subject is `Your Sign In Code`
  - the template editor exposes Supabase variables including `{{ .Token }}`, `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, and `{{ .RedirectTo }}`
  - the `Save changes` button was disabled, meaning no unsaved dashboard edits were present during inspection
- The dashboard accessibility output did not expose the full body HTML reliably.
- Therefore full manual email OTP template signoff still requires a human visual check that the body itself clearly contains `{{ .Token }}` and user-facing Second Act copy.
- For Phase 2 local/dev signoff, custom SMTP is not required.
- Before production, custom SMTP or another production-grade email delivery posture should be treated as a separate production-readiness requirement.

### Q: Why did a first-time email OTP user receive `Confirm your signup` without a code?

A:

- For first-time passwordless email users, Supabase can send the `Confirm sign up` template rather than the `Magic link or OTP` template.
- That means configuring only `Magic link or OTP` is not enough for Second Act's code-entry UX.
- If the `Confirm sign up` template only contains `{{ .ConfirmationURL }}`, the user receives a link-only email while the app asks for a code.
- The app's current email flow is still correct for Phase 2:
  - request: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })`
  - verify: `supabase.auth.verifyOtp({ email, token, type: "email" })`
- Supabase's email template variables include:
  - `{{ .ConfirmationURL }}` for a link
  - `{{ .Token }}` for the six-digit OTP
  - `{{ .TokenHash }}` for custom link flows
  - `{{ .RedirectTo }}` for the redirect URL passed by the app
- Project rule:
  - both `Confirm sign up` and `Magic link or OTP` must include a visible `{{ .Token }}` before Stage 3 provider signoff.
  - link-only templates are incompatible with the current login form.

Suggested local/dev subject:

`Your Second Act sign-in code`

Suggested local/dev HTML body for `Confirm sign up` and `Magic link or OTP`:

```html
<h2>Your Second Act sign-in code</h2>
<p>Use this code to continue signing in to Second Act:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">{{ .Token }}</p>
<p>This code expires shortly. If you did not request it, you can ignore this email.</p>
<p>If you prefer to use a link, continue here:</p>
<p><a href="{{ .ConfirmationURL }}">Continue to Second Act</a></p>
```

Manual retest:

- Use a fresh email address or delete the previous test Auth user to test first-time behavior.
- Start from `/login?next=/` until `/app` is implemented.
- Confirm the first-time email contains a visible code and that entering it redirects to `/`.
- Repeat with the same email to confirm the returning-user email also contains a visible code.

### Q: Why did an existing email user see `We could not complete sign-in` during repeated OTP testing?

A:

- The dev log showed Supabase returning `email rate limit exceeded` from the browser `signInWithOtp` request.
- This is a provider-side email throttle, not evidence that the existing user profile or account is broken.
- The login form should keep credential/account failures generic, but rate-limit responses can safely tell the user to wait and retry because that does not reveal whether an email has an account.
- Current UX rule:
  - email OTP send/verify rate-limit errors show `Too many code requests. Please wait a bit and try again.`
  - other Google/email/OTP auth failures keep the generic `We could not complete sign-in. Please try again.`

### Q: How should auth `next` redirect values be sanitized?

A:

- Auth redirects must be same-app, relative-only paths.
- The Stage 3 auth helper should reject:
  - missing values
  - absolute URLs such as `https://example.com`
  - protocol-relative URLs such as `//example.com`
  - raw backslashes, because browsers and URL parsers may normalize them as path separators
  - raw ASCII control characters such as tabs/newlines
  - percent-encoded control characters
  - percent-encoded slash/backslash sequences such as `%2f` or `%5c`
- The helper should still parse accepted candidates against a local fake origin and verify the parsed origin has not changed.
- The final returned redirect should be reconstructed from parsed `pathname`, `search`, and `hash`, and should be checked again to ensure it does not begin with `//`.
- This defense-in-depth rule was added after a post-Stage 3 security scan flagged known browser-specific open redirect bypass vectors.

### Q: Is manual auth-provider testing required before moving past Stage 3?

A:

- Stage 3 is code-complete when automated tests, typecheck, lint, build, and login-page rendering all pass.
- However, Stage 3 is not fully provider-signed-off until at least one live Google OAuth flow and one live email OTP flow are tested against the configured Supabase project.
- This manual provider test is recommended before Stage 4 profile bootstrap because Stage 4 depends on real Supabase authenticated users existing.
- If the user wants to keep implementation moving, Stage 4 can still be developed using mocked/authenticated helper tests, but final Phase 2 signoff must include the real Google and email OTP flows.
- Because `/app` is not implemented until a later stage, manual Stage 3 auth smoke tests should use a known existing safe redirect such as:
  - `/login?next=/`
  - `/login?next=/legal`
- The minimum manual smoke test is:
  - Google sign-in reaches `/auth/callback` and redirects back to the selected safe local path
  - email OTP sends an email, the template contains a visible OTP code, and entering the code redirects back to the selected safe local path
  - Supabase Auth Users shows the expected user
  - no external redirect is accepted in `next`
  - visiting `/auth/logout` after a live login redirects to `/` and clears the Supabase browser session
- The logout route's automated test proves that the route calls Supabase `signOut()` and redirects home.
- It does not replace the live browser check, because the live check confirms real Supabase cookies/session state in the configured project.
- Before `/app` is implemented and protected, logout can be smoke-tested by visiting `/auth/logout` directly after a successful `/login?next=/legal` login.
- After `/app` and the proxy guard exist, repeat logout from the app shell and confirm `/app` requires login again.

### Q: How does Phase 2 profile bootstrap connect Supabase Auth to Second Act app data?

A:

- Supabase Auth remains the identity provider and source of truth for login/session state.
- `auth.users.id` is the stable user ID that must match `public.user_profiles.id`.
- `public.user_profiles` is the Second Act app-profile row:
  - email
  - first name
  - last name
  - investor handle
- `public.user_usage.user_id` tracks usage counters for the same user ID.
- Phase 2 Step 4 added a server-side bootstrap service:
  - if `user_profiles` already exists, load it and preserve its fields
  - if it is missing, create it from authenticated Supabase user claims
  - always ensure the matching `user_usage` row exists
- Google users can supply names from Supabase user metadata.
- Email OTP users must not be asked for first/last name on the initial login form based on a pre-auth email lookup.
- Checking whether an email is first-time or returning before OTP verification would risk email/account enumeration.
- After OTP verification, email users are routed to the login-page profile step (`/login?step=profile`).
- Returning users with an existing `user_profiles` row are immediately redirected to the requested app path.
- First-time email users without profile metadata must complete first and last name inside the same login visual shell.
- `/profile/setup` remains a compatibility redirect into `/login?step=profile`.
- Bootstrap throws `PROFILE_COMPLETION_REQUIRED` when profile names are missing instead of creating placeholder names.
- The investor handle is generated from the email local part and retries if a unique-handle collision occurs.
- The bootstrap runs in two places:
  - after successful `/auth/callback` session creation
  - again inside the `/app` server layout as an idempotent safety net
- If callback bootstrap fails after the Supabase session is established, the app signs out and redirects back to login instead of entering a half-created account state.
- If `public.user_profiles.email` already exists under a different profile ID than the current `auth.users.id`, bootstrap must not silently attach that profile to the new auth user.
- This mismatch can happen in local/dev if an Auth user is deleted/recreated or if provider testing creates a new identity for an existing email.
- The app should treat it as `PROFILE_EMAIL_ALREADY_LINKED` and require manual cleanup or a deliberate future account-linking flow.
- Local cleanup is safe only after confirming the old profile has no portfolios, holdings, report runs, or report artifacts attached.
- `user_usage` bootstrap must be idempotent under concurrent `/app` loads.
- If two bootstraps race and one creates `public.user_usage` first, a Prisma `P2002` from `userUsage.upsert()` means the row already exists and should be treated as success.
- In local Next.js dev, `console.error` from server code can appear as an in-page `Console Error` overlay; production should log server errors without rendering that dev overlay, but the underlying bootstrap failure still needs fixing.

### Q: What does the Phase 2 Step 5 `/app` shell protect, and what is still deferred?

A:

- Step 5 protects the `/app` route tree at the server layout boundary.
- An unauthenticated request to `/app` redirects to `/login?next=/app`.
- The shell displays:
  - Second Act brand
  - authenticated profile name/email/handle
  - logout form posting to `/auth/logout`
  - navigation placeholders for Dashboard, Portfolios, Reports, and Account
- Step 5 intentionally does not replace the global middleware/proxy auth guard.
- Step 5 intentionally does not migrate report APIs away from the existing `X-User-Id` placeholder.
- Those changes remain Stage 6 and Stage 7 work respectively.
- Before Stage 6 starts, manually test a live Google and email OTP login into `/app`, verify the profile and usage rows in Supabase, sign out from the app shell, and confirm `/app` redirects back to login afterward.

### Q: Why can a Next.js auth page render but the login buttons do nothing?

A:

- In the Next.js App Router, server-rendered HTML can appear correct even when client hydration fails.
- One concrete Stage 3 bug was caused by a static CSP header:
  - `script-src 'self'`
- That blocked the inline Next.js bootstrap/RSC scripts such as `self.__next_r` and `self.__next_f`.
- Result:
  - `/login` rendered visually
  - React event handlers did not attach
  - Google/email auth buttons appeared inert
- The correct project rule is:
  - do not put a static App Router CSP in `next.config.ts` if it blocks inline framework scripts
  - generate CSP per request in middleware/proxy with a nonce
  - pass the CSP on the request so Next can nonce framework scripts
  - set the same CSP on the response
- The same Stage 3 fix also added the Supabase project origin to `connect-src`, because browser OTP calls go directly to Supabase Auth.
- Google Fonts are intentionally allowed through:
  - `style-src https://fonts.googleapis.com`
  - `font-src https://fonts.gstatic.com`

### Q: Why must client Supabase public env reads use direct `NEXT_PUBLIC_*` references?

A:

- Next.js only reliably exposes public environment values to browser bundles when the code references the exact public key directly, such as:
  - `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- A helper that reads public env dynamically, such as `process.env[name]`, can work in Node tests but fail in the browser bundle.
- In Stage 3 this caused Supabase browser client creation to fail after hydration was fixed.
- The project rule is:
  - shared client/server public config helpers may accept injected env objects for tests
  - their default browser/runtime path must use direct `process.env.NEXT_PUBLIC_*` references
- Auth forms should catch Supabase initialization and auth-call failures, show a generic user-facing error, and avoid leaving buttons stuck in a pending state.

## 8) Market Data Clarifications

### Q: Why are we using `yfinance` for the current build?

A:

- Because it is open, easy to use, and good enough for the dev/build phase.
- It lets us validate the portfolio-to-report pipeline without committing early to a production provider.

### Q: Why do we still need a `MarketDataProvider` abstraction if we are already using `yfinance`?

A:

- Because `yfinance` is only the current adapter implementation, not the architecture.
- The abstraction protects the rest of the system from provider-specific behavior and makes later provider swaps feasible.

### Q: If we move to Alpha Vantage later, do we still keep the Python adapter?

A:

- Most likely, yes.
- The Python adapter is no longer “the `yfinance` layer.”
- It is now the internal market-data service boundary between Node and the underlying provider.

So later we can:

- keep the FastAPI adapter
- replace or add a new provider implementation inside it
- keep Node talking to the same internal API

### Q: Was the Python adapter introduced only because `yfinance` is a Python library?

A:

- No.
- The adapter now exists because it provides:
  - provider isolation
  - normalization
  - a stable internal API
  - easier provider swaps later

### Q: How expensive would it be to switch from `yfinance` to Alpha Vantage later?

A:

- If the current boundaries are preserved, the switch should be low-to-medium effort.
- Mostly it should involve:
  - a new provider implementation
  - env/config updates
  - any provider-specific mapping/caching work

It should **not** require redesigning:

- the Node market-data boundary
- the canonical model
- the analysis engine
- the narrative engine
- the PDF layer

### Q: Why was the Node implementation named `MarketDataAdapterProvider` instead of `YFinanceProvider`?

A:

- Because the Node layer is not talking to Yahoo directly.
- It is talking to the internal Python adapter.
- Naming it after Yahoo would leak the current provider choice into a higher layer and make future swaps less clean.

## 9) Supabase Connection Clarifications

### Q: What is the difference between `DATABASE_URL` and `DIRECT_URL` in this project?

A:

- `DATABASE_URL` is the practical pooled/session connection used for the app/runtime path.
- `DIRECT_URL` is the more direct Postgres path that is useful in some environments and tooling situations, but not always practical in the current setup.

### Q: Why did `DIRECT_URL` fail earlier?

A:

- Supabase direct connections are not always usable from IPv4-only environments without extra support.
- That is why the project settled on the pooled runtime connection as the practical path for local and Vercel-style environments.

### Q: Does Vercel support the direct Supabase connection path cleanly?

A:

- Not reliably in the current project assumptions.
- For practical purposes, Vercel/current IPv4-style environments should use the pooled runtime connection path.

## 10) Contract And Compliance Clarifications

### Q: Why are monetary values represented as strings in contracts instead of numbers?

A:

- To reduce precision drift across boundaries.
- The contracts are meant to be safe for financial data movement, even if internal calculations later use decimal tooling.

### Q: Why is the disclaimer system-owned rather than generated by the LLM?

A:

- Compliance/disclaimer language must remain deterministic and under our control.
- The LLM should generate narrative sections only, not legal/compliance text.

### Q: Did the analysis contract need to match the Notion taxonomy?

A:

- Yes.
- Instead of hardcoding a brittle fixed structure, the analysis contract was made taxonomy-friendly with a flexible `sections[]` shape so the seven Notion analysis areas can be mapped cleanly.

### Q: Does the `portfolio-metrics` document fit the backend design we have built so far?

A:

- Yes, overall it fits the current Step 7 design well.
- The seven major sections line up cleanly with the taxonomy-friendly `sections[]` analysis contract.
- Most of the metrics are derivable from the current canonical snapshot without changing the database schema.
- The main items that need extra product rules before implementation are:
  - rebalancing metrics, because they require target weights and tolerance bands that are not yet stored in the current schema
  - internal benchmark details, because the exact benchmark definition must be locked before coding
  - edge-case handling for zero denominators, partial market data, and zero-cost-basis situations
- So the document is a strong fit, but a few formulas still need explicit implementation rules before Step 7 starts.

### Q: What did we decide for Phase 1 regarding rebalancing metrics and internal benchmark?

A:

- Rebalancing metrics are deferred out of Phase 1.
- That means these are not part of the first analysis-engine implementation:
  - Rebalancing Signals
  - Trim / Add Framework
- For the Internal Benchmark metric in Phase 1, the chosen benchmark definition is:
  - equal-weight internal benchmark
- This keeps Step 7 implementable with the current schema and avoids introducing target-weight/tolerance-band configuration too early.

### Q: What are the locked Step 7 analysis rules for Phase 1?

A:

- All analysis outputs should be expressed in the run's `reportingCurrency`.
- Phase 1 analysis covers the non-rebalancing sections of the taxonomy:
  - Performance & P&L
  - Allocation & Concentration
  - Risk Proxies
  - Portfolio Health & Diagnostics
  - Scenario & Stress Testing
  - Comparative & Benchmark-lite
- Rebalancing metrics remain deferred because the current schema does not store target weights or tolerance bands.
- If partial market data would make a portfolio-level metric misleading, that metric should be `null` rather than estimated.
- Holding-level metrics can still be shown when they remain safe to compute from the available canonical snapshot data.
- The Phase 1 internal benchmark is the equal-weight version of the current holdings set.

### Q: Is `investor_handle` part of the report pipeline?

A:

- Not right now.
- It is currently a profile/UI concept.
- It can be added to the report metadata later without major architecture changes if there is a product reason.

## 11) Security Clarifications

### Q: Why was the market-data adapter protected with an internal shared secret?

A:

- Because `/market-data/quotes` should not be an open internal service even if it usually binds to localhost.
- The secret protects the adapter from being openly callable if deployment/network assumptions change.
- Node must send the secret on every authenticated market-data request.

### Q: If detailed adapter error messages exist internally, is that okay?

A:

- Yes for internal server-side layers.
- But later user-facing layers must not pass raw adapter messages through to end users.
- The correct rule is:
  - log raw/internal detail server-side
  - return generic user-facing messages outward

### Q: Why does the Step 6 repository load a report run by `reportRunId` without a `userId` filter?

A:

- Because the current Step 6 canonical-model repository is designed for internal background-worker-style execution, where the queue/job dispatcher is already responsible for selecting the correct run.
- That is acceptable for worker-only paths, but it is an important contract assumption.
- If this repository logic is ever reused from a user-facing API route, the caller must first verify that the `reportRunId` belongs to the authenticated user before calling into it.
- In other words, ownership enforcement is required at the API/service boundary before this repository path is reused outside internal worker flows.

### Q: Was the `.venv` tracking issue real?

A:

- It was worth checking, but in the current repo state `.venv` was not tracked in Git.
- A Python lock file was still added for better auditing and reproducibility.

### Q: How should we handle the npm audit findings around Vite and Prisma dev tooling?

A:

- The Vite advisory should be fixed when a non-breaking locked-version update is available, even though it only affects local development tooling.
- In this repo, that meant updating the transitive Vite lock from `8.0.3` to a patched `8.0.7` through the Vitest dependency tree.
- The remaining `hono` / `@hono/node-server` moderates come from `prisma -> @prisma/dev`, which is Prisma CLI/dev-tooling rather than the production runtime request path.
- Those remaining moderates should be deferred until Prisma ships a safe upgrade path in the current major line or we intentionally schedule a Prisma upgrade pass.
- We should avoid `npm audit fix --force` for those findings because it introduces unrelated Prisma churn without a clear runtime-security payoff for the current app.

## 12) Testing Clarifications

### Q: Did the project need a testing foundation early, or could it wait?

A:

- The recommendation was to add a pragmatic testing baseline early, not a huge testing framework all at once.
- The reason is that financial calculations and normalization logic are exactly the kind of code that can regress silently.

### Q: Why was testing work split into a separate chat/document?

A:

- To keep this backend pipeline thread focused on architecture and implementation progress.
- A separate testing note was created so testing conventions can evolve without cluttering the backend build discussion.

### Q: Should every Step 4/5 change be sent back to the testing chat immediately?

A:

- Not necessarily.
- Focused tests were added where they were needed for the step itself.
- The separate testing thread becomes more valuable as later business logic grows, especially in Step 6 and Step 7.

## 13) Process Clarifications

### Q: Do different chats under the same project directory share full context?

A:

- No.
- They share the same files/workspace, but not the full conversational memory.
- That is why the `chatbotNotes` documents matter so much.

### Q: Why do we keep both an execution document and a knowledge base document?

A:

- The execution document explains:
  - what was implemented
  - what passed
  - what remains

- This knowledge base explains:
  - why certain decisions were made
  - how key tradeoffs were resolved
  - what architecture/security clarifications were established

Both are useful, but they solve different memory problems.

## 14) API Clarifications

### Q: Once the backend is fully implemented, what will likely be exposed from an API perspective?

A:

- The expected external backend surface is likely to be centered around:
  - portfolio management endpoints
  - report-run creation endpoints
  - report-run status/history endpoints
  - artifact download or signed-URL retrieval endpoints
- Internal-only services like the Python market-data adapter are not expected to be public API surfaces.
- The frontend should talk to the main backend/API layer, and that backend layer should orchestrate the internal worker and adapter pieces behind the scenes.

### Q: Will the complete backend be testable through Postman alone?

A:

- Mostly yes, for the user-facing API surface.
- Postman should be enough to test:
  - creating/updating portfolios
  - triggering report generation
  - polling report status
  - listing prior reports
  - fetching artifact metadata or download links
- But there are some important caveats:
  - auth flows like Google sign-in are not naturally "Postman-only" flows, even if authenticated API calls can still be tested once a valid token/session is available
  - long-running report generation is asynchronous, so Postman would test it as a create-run call followed by status polling, not as one single synchronous request
  - internal microservice boundaries are not the public product API and do not need to be exposed just to make Postman testing possible
- So the right mental model is:
  - yes, the product backend should be largely Postman-testable
  - no, not every internal layer needs to be directly exposed as a public API endpoint

### Q: At what step does the public API layer get implemented?

A:

- In the Phase 1 plan, the public product API comes in **Step 12**.
- That is intentional.
- The earlier steps build the internal pipeline first:
  - market-data adapter
  - Node market-data client
  - canonical snapshot
  - deterministic analysis
  - narrative output
  - PDF generation
  - storage/artifact metadata
  - queue/worker orchestration
- By the time Step 12 is reached, the API layer can stay thin and mostly do:
  - request validation
  - user-scoped authorization
  - create/enqueue report runs
  - status reads
  - PDF retrieval
- So the backend becomes broadly Postman-testable at the public API level in Step 12, while some internal pieces are command-testable earlier.

## 15) Working Rule For Future Clarification Questions

When important clarification questions come up in this backend thread, this file should be updated if the answer establishes:

- a lasting architectural rule
- a security rule
- an infra decision
- a modeling decision
- a process/ownership rule worth preserving

That keeps the knowledge base useful instead of turning it into a full transcript.

## 16) Hardening Rules From Post-Step-7 Security Review

### Q: How should unsupported provider currencies be handled in the market-data pipeline?

A:

- Unsupported provider currencies must **not** be silently treated as if they already match the run's reporting currency.
- If the provider returns a currency outside the current MVP-supported set (`USD`, `CAD`) and it cannot be safely inferred:
  - the security should remain **unpriced**
  - `fxRateToReportingCurrency` should stay `null`
  - data-quality flags should include:
    - `unsupported_security_currency`
    - `fx_rate_unavailable`
- Downstream canonical snapshot logic must preserve that as a partial-data case rather than manufacturing a `1.0` FX rate.
- This is a financial correctness rule, not just a provider-normalization preference.

### Q: What is the difference between portfolio base currency and report reporting currency in the canonical snapshot?

A:

- `CanonicalPortfolioSnapshot.baseCurrency` represents the portfolio's configured base currency.
- It must come from `portfolio.base_currency`, not from the `report_runs.reporting_currency` field.
- If a run is ever generated in a reporting currency that differs from the portfolio base currency:
  - the snapshot must still preserve the real portfolio base currency
  - the difference should be surfaced via the existing `reporting_currency_differs_from_portfolio_base_currency` data-quality flag
- So:
  - `portfolio base currency` = long-lived portfolio metadata
  - `reporting currency` = run-level valuation/reporting context

### Q: Should unfinished future-stage env vars block earlier pipeline stages from booting?

A:

- No.
- Runtime configuration should be split by stage/concern so unfinished later steps do not block already-implemented parts of the pipeline.
- Specifically:
  - the core/backend pipeline env should cover the currently built DB, queue, Supabase, market-data, and Playwright concerns
  - narrative-specific env should be parsed separately only when the narrative stage is actually used
- This keeps pre-Step-8 code paths from failing just because narrative provider settings are not configured yet.

## 17) Narrative Stage Clarifications

### Q: Should the LLM stage use an adapter/provider abstraction too?

A:

- Yes, the LLM side should be swappable through a provider abstraction.
- But unlike market data, it does **not** need to be a separate microservice in Phase 1.
- The right Phase 1 shape is:
  - Node-side `NarrativeProvider` abstraction
  - one concrete provider for a local OpenAI-compatible endpoint during dev
  - ability to swap to a paid hosted provider later without redesigning the pipeline
- This keeps the architecture clean without adding an unnecessary extra network hop.

### Q: Do too many adapters hurt performance?

A:

- Code-level adapters and interfaces do not meaningfully hurt performance.
- The real cost comes only when an adapter becomes a separate networked service:
  - extra network hop
  - extra failure point
  - extra config/deploy/runtime overhead
- So:
  - provider abstractions are good architecture
  - extra microservices should be used only when they solve a real boundary problem

### Q: How should local LLM development be configured for Phase 1?

A:

- The current Phase 1 dev setup uses a local Ollama endpoint through an OpenAI-compatible API surface.
- The agreed local narrative-stage env is:
  - `NARRATIVE_PROVIDER=openai-compatible`
  - `NARRATIVE_PROVIDER_BASE_URL=http://127.0.0.1:11434/v1`
  - `NARRATIVE_PROVIDER_API_KEY=ollama`
  - `NARRATIVE_MODEL=phi3:mini`
- We intentionally kept the existing `NARRATIVE_*` env naming instead of introducing a second `LLM_*` naming scheme.

### Q: What are the key prompt rules for the narrative stage?

A:

- The model explains metrics; it does **not** calculate them.
- The model receives preformatted values rather than being asked to do formatting or math.
- The model must use only supplied facts and context.
- The model must explicitly handle missing or low-confidence data carefully.
- The model must return JSON only.
- Disclaimer/compliance language remains system-owned and stays out of the LLM output.

### Q: Should narrative output be flat text or section-based?

A:

- Section-based.
- The narrative stage should mirror the analysis taxonomy so the output stays reusable for:
  - PDF assembly
  - future UI presentation
  - future prompt evolution
- The richer output shape should include:
  - section summaries
  - section key takeaways
  - metric-by-metric narratives
  - metric-specific takeaways

### Q: How should the provider handle malformed model output?

A:

- The provider should parse and validate the model's JSON output strictly.
- If the first model response is invalid JSON, one repair retry is acceptable.
- If the output is still invalid after one retry, the stage should fail cleanly rather than silently accepting malformed or drifted output.

### Q: How was the narrative layer hardened for smaller or weaker models?

A:

- The final persisted `narrative_output` contract did **not** change.
- The provider boundary changed so the app now owns section and metric identity.
- The model only returns prose fields:
  - `summary_narrative`
  - `key_takeaways`
  - `metrics[].narrative`
  - `metrics[].takeaways`
- The provider merges those prose fields back onto the known section keys, section titles, metric names, and display names from deterministic app input.
- This improves reliability for weaker local models without requiring downstream report assembly or PDF rendering changes.
- In a final bounded hardening pass for `phi3`, the prompt payload was also updated to include an explicit prose-only `output_template` so the model can fill a scaffold instead of inferring section and metric counts.

### Q: Should we optimize prompt size and narrative latency right now for production?

A:

- Not yet.
- The current decision is to keep the Step 8 narrative design as implemented for now, then revisit speed tuning after Step 12 once there is a real end-to-end report experience to evaluate.
- At that later checkpoint, we should review:
  - prompt size reduction
  - narrative input payload reduction
  - output length limits
  - whether section-by-section generation is needed
  - whether a faster hosted production model is a better fit
- The goal is to optimize based on actual report feel and real latency observations, not guess too early.

### Q: Is the narrative engine designed as an adapter so we can switch between Gemini, GPT, and Claude?

A:

- Yes. The narrative engine has an explicit adapter/provider pattern with three layers:

**Layer 1 — The interface (`src/server/providers/narrative-provider.ts`):**

```ts
export interface NarrativeProvider {
  readonly providerName: string;
  generateNarrative(input: GenerateNarrativeInput): Promise<GenerateNarrativeResult>;
}
```

The file's own comment describes it as a *"Swappable provider boundary"*. The engine is coded entirely against this interface.

**Layer 2 — Dependency injection in `NarrativeEngineService`:**

The service accepts `narrativeProvider?: NarrativeProvider` as an injected dependency:

```ts
this.narrativeProvider =
  dependencies.narrativeProvider ?? createOpenAICompatibleNarrativeProvider();
```

`OpenAICompatibleNarrativeProvider` is the default fallback, not a hardcoded dependency. To swap the LLM, pass a different implementation at construction time. `NarrativeEngineService` does not change at all.

**Layer 3 — The concrete implementation (`OpenAICompatibleNarrativeProvider`):**

This class is built to talk to any endpoint that speaks the OpenAI Chat Completions protocol (`POST /chat/completions`, Bearer token auth). The `baseUrl`, `model`, and `apiKey` are all runtime configuration from env vars, not hardcoded.

### Q: Which LLM providers can we switch to without writing new code?

A:

- Any provider that speaks the OpenAI Chat Completions API format works with the existing `OpenAICompatibleNarrativeProvider` by simply changing env vars:

| Provider | `NARRATIVE_PROVIDER_BASE_URL` | `NARRATIVE_MODEL` example |
|---|---|---|
| OpenAI (GPT-4o, GPT-4-turbo) | `https://api.openai.com/v1` | `gpt-4o` |
| Gemini (via OpenAI compat layer) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-1.5-pro` |
| Ollama (local, any model) | `http://127.0.0.1:11434/v1` | `llama3`, `phi3:mini`, etc. |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-70b-versatile` |

The dev environment is already set up this way, pointed at a local Ollama endpoint using `phi3:mini`.

### Q: When would we need to write a new NarrativeProvider implementation?

A:

- Only when the target LLM uses a **different wire protocol** that does not conform to the OpenAI Chat Completions spec.
- The most likely real case is Claude via the **Anthropic native API**, which uses a different request/response shape.
- In that case, writing a new `AnthropicNarrativeProvider implements NarrativeProvider` class would be enough — roughly one isolated file of ~200 lines.
- Everything else stays completely unchanged: the service, the contracts, the prompts, the Zod schemas, the repository, and the rest of the pipeline.

### Q: What parts of the narrative engine are completely provider-agnostic?

A:

- These layers are not affected at all when switching LLM providers:
  - `narrative-provider.ts` — the interface contract, never changes
  - `build-narrative-input.ts` — builds the structured prompt input from analysis output
  - `narrative-explainer.ts` — the system prompt and user prompt builder (plain text)
  - `narrative.ts` (contracts) — Zod schemas for input/output shapes
  - `NarrativeEngineService` — pipeline orchestration, never touches HTTP
  - `PrismaNarrativeEngineRepository` — persists the result, fully independent
- Prompts are written as plain model-agnostic instruction text, not optimized for any specific LLM's quirks.

## 18) PDF Generation Clarifications

### Q: Where does the mandatory disclaimer text come from for the PDF report?

A:

- The disclaimer is system-owned and lives in `src/server/shared/constants.ts` as `REPORT_DISCLAIMER_TEXT`.
- It is locked via `z.literal()` in the `reportComplianceSchema`, so the LLM cannot modify or override it.
- The PDF renderer reads it directly from the `ReportDocument.compliance` block.
- It is never generated by the narrative provider.

### Q: Where does the executive summary content come from for the PDF report?

A:

- The executive summary is deterministically assembled from data already present in the `ReportDocument`:
  - portfolio totals from `canonicalSnapshot.portfolioTotals` (total market value, cost basis, unrealized P&L, P&L %, holding count)
  - top-level analysis summary from `analysisOutput.summary` (gainers/losers count, HHI, largest position weight)
  - key findings from each analysis section's `findings[]` array
  - reporting currency from `portfolio.reportingCurrency`
- No LLM-generated content is used in the executive summary.
- No hardcoded copy is needed.

### Q: What visual style should the PDF report use?

A:

- Light/white professional report style, not the dark-themed landing page aesthetic.
- Web-safe system fonts (Georgia for headings, Helvetica/Arial for body, monospace for numbers).
- Orange accent (`#f96b2a`) for headings and dividers to maintain brand connection.
- Dedicated cover page as page 1, content starts on page 2.
- Self-contained HTML with all CSS inline (no external dependencies).
- A4 print-optimized with proper margins and page-break controls.

### Q: Why does the PDF renderer validate `runId` as a UUID before constructing the output path?

A:

- The renderer uses `runId` inside `path.join("/tmp/secondact", runId, "report.pdf")`.
- Even though `ReportDocument` is validated by Zod at the contract level, the renderer itself should not trust that callers have pre-validated the input.
- A malformed `runId` like `../../etc` would cause a path traversal, writing the PDF outside the intended temp directory.
- Adding `uuidSchema.parse(input.metadata.runId)` at the top of `render()` ensures the renderer fails fast with a clear error instead of writing to an unexpected path.
- This follows the defense-in-depth principle: validate at system boundaries, not just at the contract level.

---

## 19. Storage and Artifact Metadata Clarifications (Step 10)

### Q: How does the storage upload flow work?

A:

1. The `ArtifactStorageService.storeForReportRun()` method accepts a `reportRunId`, `userId`, and `RenderPdfResult` (local PDF path, mimeType, byteSize, checksum).
2. It validates both `userId` and `reportRunId` via `uuidSchema.parse()` before constructing the storage path.
3. It reads the local PDF file via `fs.readFile()`.
4. It uploads the PDF buffer to Supabase Storage at `{userId}/{reportRunId}/report.pdf` in the configured bucket.
5. It creates a `report_artifacts` row via Prisma with `BigInt` for `fileSizeBytes`.
6. It cleans up the local temp directory via `rm(tempDir, { recursive: true, force: true })`.
7. It returns `{ artifactId, storageBucket, storagePath }`.

### Q: Why is there a separate `StorageUploader` interface?

A:

- The `StorageUploader` interface decouples the service from the Supabase SDK so tests never hit a real Supabase instance.
- The `SupabaseStorageUploader` implementation wraps the Supabase Storage `upload()` call and throws `ArtifactUploadError` on failure.
- The same interface could be swapped for an S3 or local-filesystem implementation if needed.

### Q: Why does the Supabase admin client use `{ auth: { persistSession: false } }`?

A:

- The Supabase admin client runs server-side only (inside the worker or API layer).
- Persisting sessions is unnecessary and could cause confusion with the service-role key, which is an admin-level secret.
- Disabling session persistence ensures no session tokens are stored in-process.

### Q: How does `fileSizeBytes` get handled as a BigInt?

A:

- The Prisma schema defines `fileSizeBytes` as `BigInt` (`@db.BigInt` in PostgreSQL).
- The service converts `renderResult.byteSize` (a JS `number`) to `BigInt` via `BigInt(value)`.
- If `byteSize` is undefined in the render result, the service falls back to `fileBuffer.byteLength`.
- Tests explicitly assert that the stored value is of type `bigint`.

### Q: What happens if the upload fails?

A:

- The service calls `storageUploader.upload()` before `repository.createArtifactRecord()`.
- If the upload throws `ArtifactUploadError`, the metadata row is never created (no dangling references).
- The temp directory is NOT cleaned up on upload failure — the caller can retry or inspect the file.
- Supabase Storage is called with `upsert: false`, meaning re-uploading the same path is an error. If a retry encounters a duplicate (orphaned blob from a prior attempt), the uploader throws `ArtifactAlreadyExistsError` (subclass of `ArtifactUploadError`), which the service catches and continues to the metadata write. Non-duplicate upload errors propagate normally.

---

## 20. Queue, Worker, and Concurrency Clarifications (Pre-Step 11)

### Q: How does the end-to-end user experience work with the queue?

A:

1. User clicks "Generate Report" → frontend calls `POST /api/v1/report-runs` with `portfolioId`.
2. API creates a `report_runs` row (status `QUEUED`), adds a job to the graphile-worker Postgres queue, and returns immediately with `{ runId, status: "QUEUED" }`. The user does NOT wait for the report.
3. Frontend polls `GET /api/v1/report-runs/:runId` periodically. User sees a "generating..." state.
4. The worker process (separate from the API server) picks up the job asynchronously and runs the full pipeline: canonical → analysis → narrative → render PDF → upload → mark COMPLETED.
5. When the poll returns `status: "COMPLETED"`, the frontend shows a download button.
6. User calls `GET /api/v1/report-runs/:runId/pdf` to download.
7. On failure, the poll returns `status: "FAILED"` with an error message.

### Q: Is the report pipeline async or sequential?

A:

- **Async from the user's perspective**: the HTTP request returns instantly. The heavy work happens in a background worker process.
- **Sequential within a single report**: the pipeline stages (canonical → analysis → narrative → render → upload) run one after another because each stage depends on the previous stage's output. They cannot be parallelized.
- **Concurrent across different reports**: graphile-worker can process multiple jobs simultaneously, up to the `GRAPHILE_WORKER_CONCURRENCY` setting. Different users' reports run in parallel.

### Q: What does `GRAPHILE_WORKER_CONCURRENCY` control and what should it be in production?

A:

- It controls how many jobs a single worker process handles in parallel. Default is 1 (one job at a time).
- **Concurrency=1 does NOT mean only one user can use the app.** The API server handles unlimited concurrent HTTP requests. All users can request reports simultaneously — they just queue up.
- With concurrency=1 and ~30-60 second reports, throughput is ~60-120 reports/hour. This is fine for dev/staging and even early production with low traffic (small beta of 50-200 users generating quarterly reports).
- **Concurrency=1 breaks down** when burst traffic causes queue wait times to exceed an acceptable threshold (e.g., 20+ simultaneous requests → last user waits 10-20 minutes).
- **Recommended production starting point**: `GRAPHILE_WORKER_CONCURRENCY=3` — handles reasonable bursts without overloading a single server.
- **Scaling options**: increase concurrency on one process, run multiple worker instances (graphile-worker handles locking safely), or scale horizontally across machines.
- This is a runtime knob — tune based on real usage patterns, monitored via queue depth and average wait time.

### Q: Does the worker process run inside Supabase?

A:

- **No.** Supabase provides the Postgres database and object storage, but does NOT run the worker process.
- graphile-worker creates its own tables (in the `graphile_worker` schema) inside the Supabase Postgres instance to store the job queue. The **queue data** lives in Supabase, but the **worker process** is a Node.js process that must be hosted separately.
- The worker connects to Supabase Postgres over the network, polls for jobs, and executes them on your own infrastructure (e.g., a VPS, Railway, Fly.io, AWS ECS, or the same server as the Next.js app).
- Supabase does have its own queue product (based on pgmq) and Edge Functions, but we chose graphile-worker because it is a mature Node.js-native solution that integrates directly with our Prisma/Postgres setup and gives full control over worker logic (retries, concurrency, error handling) without being locked into Supabase's function runtime.
- Infrastructure summary: Supabase hosts Postgres (app tables + graphile_worker queue tables) and Storage (report PDFs). Your servers host the Next.js API and the worker process. Both connect to Supabase over the network.

### Q: Does the worker pick jobs based on `report_runs.status`?

A:

- No. graphile-worker picks jobs from its own queue tables, not from `report_runs`.
- The queued job payload only contains `reportRunId`.
- After the worker picks the job, the orchestrator loads the `report_runs` row and enforces the business guard: only runs currently in `QUEUED` status are allowed to proceed.
- So a stale queue job can still be picked up, but it should be rejected immediately by the orchestrator if the run is already `FAILED`, `PROCESSING`, or `COMPLETED`.

### Q: What is the ideal backend flow when the user clicks `Generate Report`?

A:

1. Frontend calls `POST /api/v1/report-runs` with `portfolioId` and `reportingCurrency`.
2. API validates the request and confirms the portfolio belongs to the user.
3. API creates a `report_runs` row with status `QUEUED`.
4. API enqueues a graphile-worker job whose payload is `{ reportRunId }`.
5. API returns immediately with `{ runId, status: "QUEUED" }`.
6. Worker later picks the queue job and passes `reportRunId` to the orchestrator.
7. Orchestrator loads the `report_runs` row, verifies it is still `QUEUED`, and updates it to `PROCESSING`.
8. Pipeline stages run sequentially: canonical snapshot → analysis → narrative → report document assembly → PDF render → storage upload.
9. `report_runs` is updated during the pipeline with `canonical_snapshot`, `analysis_output`, `narrative_output`, and finally `status = COMPLETED`; `report_artifacts` is written when the PDF is uploaded.
10. Frontend keeps polling status; once the run is `COMPLETED`, it requests the signed PDF URL and the user downloads the report.

### Q: What happens when a worker job fails, and why can stale jobs still show up later?

A:

- If a pipeline stage throws, our orchestrator marks the `report_runs` row as `FAILED` with an error code/details.
- The queue job is a separate state machine from `report_runs`, so a stale queued job can still be picked up later if it already exists in graphile-worker.
- We now enqueue report jobs with `jobKey = report-run:<reportRunId>` and `maxAttempts = 1`, so each run gets at most one queue job and no automatic retry loop.
- Common reasons for stale job pickup:
  - an old job already existed before the single-attempt policy was applied
  - duplicate enqueue calls racing before the queue sees the same `jobKey`
  - worker crash/lock expiry causing the job to be reclaimed later
- The worker now treats `ReportRunNotQueuedError` and `OrchestratorReportRunNotFoundError` as stale-job signals: it logs them and acknowledges the job instead of rethrowing and retrying.
- So “picked up again” now usually means the queue still had a stale job row, not that the worker ignores the `QUEUED` guard.

## 21. API Route and Service Layer Clarifications (Step 12)

### Q: Why is auth handled via X-User-Id header instead of real Supabase Auth?

A:

- Full Supabase Auth integration is deferred from Phase 1 backend pipeline work.
- The `X-User-Id` header is a deliberate interim mechanism:
  - it is validated as a UUID at every route boundary
  - it flows into the service layer for user-scoped queries (portfolio ownership, run ownership)
  - it is easy to swap later for a real auth token extraction without changing the service interface
- The middleware `isAuthenticated()` stub returns `true` — this is documented and intentional for the dev build phase.
- When real auth is implemented, the swap involves:
  1. replacing `isAuthenticated()` in middleware.ts with a real session/token check
  2. replacing the `X-User-Id` header extraction in route handlers with the authenticated user ID from the session/token
  3. no changes needed in the service layer — it already receives `userId: string`

### Q: Why is there a separate service layer (`src/server/services/`) distinct from the orchestrator layer (`src/server/orchestrators/`)?

A:

- The orchestrator handles **pipeline execution**: running canonical → analysis → narrative → render → upload stages sequentially within a background worker job.
- The service handles **API-facing concerns**: request validation, user-scoped authorization, creating runs, enqueuing jobs, status reads, and signed URL generation.
- These are different responsibility domains:
  - the orchestrator is called by the worker when processing a job
  - the service is called by HTTP route handlers when serving user requests
- The service never touches pipeline stage logic. The orchestrator never handles HTTP concerns.
- A route handler creates a `ReportRunService`, not a `ReportRunOrchestrator`.

### Q: Why does each route handler create a fresh `ReportRunService()` instead of sharing one?

A:

- The service defaults its dependencies via constructor injection (`new PrismaReportRunRepository()`, etc.).
- Creating a fresh instance per request avoids shared mutable state across concurrent requests.
- The underlying Prisma client and Supabase admin client are already singletons (cached on `globalThis`), so the per-request service creation does not cause connection churn.

### Q: How does the payment gate feature flag work?

A:

- `PAYMENT_GATE_ENABLED` defaults to `false`.
- When `false`, the `createAndEnqueue()` method skips the `AWAITING_PAYMENT` status and creates runs directly as `QUEUED`.
- When `true` (future), the service would create runs as `AWAITING_PAYMENT` and only transition to `QUEUED` after payment confirmation.
- The flag is a `z.coerce.boolean()` env var so it works with string values like `"true"` / `"false"` from environment configuration.
- Phase 1 does not implement the `true` path — the flag exists so the schema and service are payment-ready without building the payment flow now.

### Q: Why does the PDF download endpoint return a signed URL instead of streaming the file?

A:

- Returning a signed URL keeps the API stateless and avoids proxying large file downloads through the Node.js process.
- The signed URL points directly to Supabase Storage, so the client downloads from the CDN/storage layer.
- The URL has a configurable TTL (`SIGNED_URL_EXPIRY_SECONDS`, default 300s / 5 minutes).
- If the URL expires, the client can request a new one by calling the endpoint again.
- The signed URL approach also works naturally with browser-based download triggers.

### Q: Why is the error response format `{ error: { code, message } }` instead of a flat shape?

A:

- The nested `{ error: { code, message } }` shape:
  - keeps the top-level response structure consistent (success responses have data fields, error responses have an `error` field)
  - allows future extension (e.g., adding `details`, `field`, or `retryable` to the error object)
  - makes client-side error handling straightforward: check `response.error` existence
- Error codes are descriptive string constants (e.g., `PORTFOLIO_NOT_FOUND`) rather than numeric codes, making them human-readable and self-documenting.

### Q: How does `quickAddJob` from graphile-worker work for enqueuing?

A:

- `quickAddJob(options, identifier, payload)` creates a short-lived database connection, adds one job to the queue, and closes the connection.
- The `options` parameter takes `{ connectionString, schema }` from the server env config.
- The `identifier` is the task name (`REPORT_RUN_TASK_IDENTIFIER` = `"report.run.generate"`).
- The `payload` is `{ reportRunId: string }` — the worker validates this with `uuidSchema.parse()` when it picks up the job.
- For Phase 1 traffic, the per-call connection overhead is negligible. If high-throughput enqueuing becomes necessary, switching to `makeWorkerUtils()` for a persistent connection pool is straightforward.

### Q: Why was the worker payload validation fix treated as a security issue?

A:

- The original code used `payload as { reportRunId: string }` — a TypeScript type assertion that does zero runtime validation.
- If a job was enqueued with an invalid or missing `reportRunId`, the orchestrator would receive bad input and either fail confusingly or (in a worst case with a crafted payload) pass an unexpected value to database queries.
- Adding `uuidSchema.parse(reportRunId)` at the task handler boundary ensures the worker fails fast with a clear Zod error on any invalid payload, before any orchestrator or database logic runs.
- This follows the defense-in-depth principle: even though the enqueue side validates, the consume side must validate independently because the queue is a trust boundary.
