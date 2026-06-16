# Phase 3 Plan: Portfolio Management MVP

Last updated: 2026-06-16

## 1) Purpose

This document is the implementation handoff plan for Phase 3.

Phase 1 proved the backend report pipeline.
Phase 2 created the authenticated app foundation.

Phase 3 should give an authenticated user the first real product action inside Second Act:

`Create portfolio -> add holdings -> review portfolio readiness`

The goal is to let a signed-in DIY investor create and manage a manual portfolio that can later be used by the existing report-generation backend.

This phase should not build the full report-generation UI yet. That belongs to the next phase.

## 2) Product Strategy Context

Second Act is built for DIY investors who want a plain-English portfolio diagnostic report without a monthly subscription.

The product promise is:

- help the user understand what they own
- avoid jargon-heavy finance UX
- keep the flow simple enough for a non-professional investor
- use deterministic backend analysis as the source of truth
- use AI only to explain computed metrics
- avoid buy/sell advice

Phase 3 is the bridge between authentication and report generation.

The user experience should feel like:

1. "I signed in."
2. "Now I can create my portfolio."
3. "I can enter my holdings without needing a broker integration."
4. "The app tells me whether the portfolio is ready for report generation."
5. "The next phase will let me generate the report."

## 3) Current Starting Point

Already complete from previous phases:

- Landing page exists.
- Phase 1 backend pipeline is signed off.
- Supabase Postgres schema exists.
- `portfolios` and `portfolio_holdings` tables already exist.
- `user_profiles` and `user_usage` already exist.
- Authenticated app shell exists under `/app`.
- Supabase Auth is integrated.
- `src/proxy.ts` protects app/API routes.
- Report APIs use authenticated Supabase user ID instead of `X-User-Id`.
- `ReportRunService` can already verify portfolio ownership when creating report runs.
- Landing page report-start CTAs are auth-aware:
  - signed-out users go to `/login?next=%2Fapp`
  - signed-in users go to `/app`
- Phase 2 automated closeout verification passed on 2026-06-10:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

Important current files:

- `chatbotNotes/phase-2-auth-app-shell-plan.md`
- `chatbotNotes/phase-2-auth-app-shell-execution.md`
- `chatbotNotes/phase-1-report-pipeline-build-execution.md`
- `chatbotNotes/backend-knowledge-base.md`
- `src/app/app/layout.tsx`
- `src/components/app/AppShell.tsx`
- `src/server/auth/api-auth.ts`
- `src/db/prisma/schema.prisma`
- `src/app/api/v1/report-runs/*`

Important Phase 2 carryover:

- Phase 2 engineering closeout is complete.
- Stage 8 landing CTA wiring is complete.
- Stage 9 automated verification is complete.
- Stage 10 documentation closeout is complete.
- Optional human/manual landing CTA smoke confirmation may still be run before or during Phase 3 if the user wants a final browser check.
- The strongest positive-path report API check remains deferred until a real owned portfolio exists.
- Phase 3 should close the positive-path owned-portfolio check after portfolio creation exists.

## 4) Phase 3 Product Outcome

By the end of Phase 3, a signed-in user should be able to:

1. Open `/app`.
2. Navigate to `Portfolios`.
3. See an empty portfolio state if they have no portfolios.
4. Create a manual portfolio.
5. Choose a portfolio base currency: `USD` or `CAD`.
6. Add holdings to the portfolio.
7. Edit holding details.
8. Remove holdings.
9. Use API-backed ticker search/autocomplete while adding holdings, with manual entry still available.
10. Edit basic portfolio details.
11. Archive a portfolio instead of hard-deleting it.
12. See whether a portfolio has enough data for the future report-generation step.
13. Confirm that ownership is enforced: users can only see and modify their own portfolios.

## 5) Scope

### In Scope

- Authenticated portfolio list page.
- Portfolio detail page.
- Create portfolio flow.
- Edit portfolio metadata.
- Archive portfolio flow.
- Add holding flow.
- Edit holding flow.
- Remove holding flow.
- API-backed ticker search/autocomplete for holding entry.
- Portfolio readiness/completeness indicator.
- Server-side portfolio service layer.
- Portfolio API routes.
- Tests for validation, ownership, API behavior, and UI-critical behavior.
- Close the deferred Phase 2 owned-portfolio positive-path API check.

### Out Of Scope

- Report generation button that actually starts a report from the UI.
- Report status polling UI.
- Report PDF download UI.
- Report history/library.
- Broker import.
- CSV import.
- Real-time market quote preview in the portfolio UI.
- Making symbol lookup mandatory before a holding can be saved.
- Asset classes beyond equity.
- Currencies beyond `USD` and `CAD`.
- Payment/checkout.
- Production worker hosting.
- Production market-data provider replacement.

## 6) Data Model Fit

No Prisma schema migration is expected for Phase 3.

Existing schema already supports the MVP:

### `portfolios`

Relevant fields:

- `id`
- `user_id`
- `name`
- `description`
- `base_currency`
- `source_type`
- `archived_at`
- timestamps

Phase 3 usage:

- create rows with `source_type = MANUAL`
- show only rows where `archived_at IS NULL` by default
- archive by setting `archived_at`, not by hard delete

### `portfolio_holdings`

Relevant fields:

- `id`
- `user_id`
- `portfolio_id`
- `ticker`
- `security_name`
- `asset_class`
- `security_currency`
- `quantity`
- `average_cost`
- `notes`
- timestamps

Phase 3 usage:

- `asset_class = EQUITY`
- `security_currency` is `USD` or `CAD`
- one consolidated row per ticker per portfolio
- duplicate ticker adds should be rejected or routed into edit/update behavior

Important existing rule:

- The database enforces unique `(portfolio_id, ticker)`.
- The UI/service should prevent duplicate tickers before relying on the DB error.

## 7) UX Principles For Phase 3

The portfolio UI should be friendly, not brokerage-terminal-ish.

Recommended UX language:

- Use "Portfolio name" instead of "Account label".
- Use "Ticker" with helper text like "Example: AAPL, SHOP.TO".
- Use "Shares / units" instead of only "quantity" in visible copy.
- Use "Average cost per share" instead of only "average cost".
- Use "Currency for this holding" instead of "security currency".
- Use "Ready for report" / "Needs holdings" instead of technical pipeline language.

Avoid:

- beta/alpha/tracking-error style jargon
- exposing raw database enum names
- making the user understand report-run internals
- asking for market value manually

Design direction:

- Preserve the app shell from Phase 2.
- Make portfolio entry feel calm and guided.
- Use progressive disclosure: list -> detail -> holdings.
- Provide empty states and validation messages that explain what to do next.

## 8) API And Service Architecture

Follow the Phase 1/2 pattern:

- Route handlers handle HTTP request/response concerns.
- Services handle business rules and ownership.
- Prisma repositories handle persistence.
- Client code never calls Prisma directly.
- Authenticated user ID comes from Supabase session helpers.

Recommended service:

- `src/server/services/portfolio-service.ts`
- `src/server/services/security-search-service.ts`

Recommended repository interface:

- `PortfolioRepository`
- `PrismaPortfolioRepository`

Recommended provider interface:

- `SecuritySearchProvider`
- `YFinanceSecuritySearchProvider` or adapter-backed local implementation for development
- future `AlphaVantageSecuritySearchProvider` or adapter implementation for production

Security search design:

- Browser/client code should call the Second Act API, not Yahoo Finance or Alpha Vantage directly.
- API route handlers should keep provider secrets server-side.
- The provider response should be normalized into a Second Act shape before it reaches the UI.
- Search should be advisory: it helps users pick a ticker and security name, but manual entry remains available.
- Search should not fetch or display live prices in Phase 3.
- Search results should not be used as the source of report readiness. Readiness remains based on saved holdings.
- Search failures should degrade gracefully to manual entry.
- Provider-specific symbol formats must be handled carefully. Yahoo-style symbols such as `SHOP.TO` may differ from Alpha Vantage symbols such as `SHOP.TRT`; production provider replacement must include symbol-format verification before launch.

Recommended route handlers:

- `GET /api/v1/portfolios`
- `POST /api/v1/portfolios`
- `GET /api/v1/portfolios/:portfolioId`
- `PATCH /api/v1/portfolios/:portfolioId`
- `DELETE /api/v1/portfolios/:portfolioId`
- `POST /api/v1/portfolios/:portfolioId/holdings`
- `PATCH /api/v1/portfolios/:portfolioId/holdings/:holdingId`
- `DELETE /api/v1/portfolios/:portfolioId/holdings/:holdingId`
- `GET /api/v1/securities/search?query=<text>`

Recommended security search response shape:

```json
{
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "region": "United States",
      "currency": "USD",
      "matchScore": "0.93",
      "provider": "yfinance"
    }
  ]
}
```

Response rules:

- `symbol` is required and should be the provider-accepted symbol that the report pipeline can later use.
- `name`, `exchange`, `region`, `currency`, and `matchScore` are optional because provider responses can vary.
- `currency` should be used to prefill `securityCurrency` only when it is confidently `USD` or `CAD`.
- Unsupported currencies should either be omitted from the dropdown or shown as unavailable, not silently converted.
- Limit returned results, for example top 8-10 matches.
- Do not expose raw provider payloads to the client.
- Do not expose provider API keys or internal adapter secrets to the client.
- Add server-side timeout and generic user-facing error behavior.

Recommended UI routes:

- `/app/portfolios`
- `/app/portfolios/new`
- `/app/portfolios/[portfolioId]`
- `/app/portfolios/[portfolioId]/edit`

For holdings:

- prefer inline add/edit forms on the portfolio detail page for Phase 3
- avoid creating too many separate pages unless the UI becomes hard to manage

## 9) Validation Rules

### Portfolio Validation

Recommended input rules:

- `name`: required, trimmed, 1-80 characters
- `description`: optional, trimmed, max 500 characters
- `baseCurrency`: required, `USD` or `CAD`

Behavior:

- normalize whitespace
- reject empty names after trim
- archive instead of hard-delete

### Holding Validation

Recommended input rules:

- `ticker`: required, trimmed, uppercase, 1-15 characters
- `ticker` allowed characters: letters, numbers, dot, hyphen
- `securityName`: optional, trimmed, max 120 characters
- `securityCurrency`: required, `USD` or `CAD`
- `quantity`: required decimal string, greater than 0, max 10 decimal places
- `averageCost`: required decimal string, greater than 0, max 8 decimal places
- `notes`: optional, trimmed, max 500 characters

Ticker examples:

- `AAPL`
- `MSFT`
- `SHOP.TO`
- `BRK-B`

Decimal handling rule:

- Treat numeric form values as strings at the route/service boundary.
- Convert to `Prisma.Decimal` only inside server-side persistence code.
- Return decimal values to the UI as strings to avoid precision loss.

Duplicate ticker behavior:

- Phase 3 recommendation: reject duplicates with a clear message.
- Message example: `This ticker is already in the portfolio. Edit the existing holding instead.`
- Do not silently aggregate in the UI unless the user explicitly chooses a merge/update action.

### Ticker Search / Autocomplete Validation

Recommended search request rules:

- `query`: required, trimmed, 2-40 characters
- `query` allowed characters: letters, numbers, spaces, dot, hyphen, ampersand
- normalize repeated whitespace before sending to the provider
- debounce client requests so typing does not call the API on every keystroke
- do not call the search endpoint until the query has at least 2 characters

Recommended search result rules:

- normalize provider symbols to uppercase before returning them to the UI
- return only equity-like results for Phase 3 where the provider exposes type/category metadata
- prefer results with `USD` or `CAD` currency
- do not save a holding automatically when a result is selected
- selecting a result should prefill `ticker`, `securityName`, and `securityCurrency` when available
- users must still confirm quantity and average cost before saving
- if the search endpoint fails or returns no results, show a small fallback message and keep manual ticker entry available

Security and privacy rules:

- the browser must never call Yahoo Finance, yfinance, or Alpha Vantage directly
- the browser must never receive provider API keys or internal adapter secrets
- provider errors should be logged server-side and mapped to generic UI copy
- search should be authenticated because it is part of the protected portfolio workspace

## 10) Manual Outside-Code Work Required

No new Supabase dashboard configuration is expected for Phase 3.

Manual tasks for the user/tester:

1. Confirm Phase 2 auth still works locally.
2. Sign in with Google or email OTP before testing portfolio pages.
3. Use Supabase Table Editor only for verification, not normal data setup.
4. After creating a portfolio through the UI, verify:
   - `portfolios.user_id` equals the signed-in Supabase Auth user ID
   - `portfolio_holdings.user_id` equals the same user ID
   - `portfolio_holdings.portfolio_id` points to the created portfolio
5. After Phase 3 creates an owned portfolio, run the deferred Phase 2 report API positive-path check:
   - call `POST /api/v1/report-runs` while signed in
   - use the newly created owned `portfolioId`
   - confirm the created `report_runs.user_id` equals the authenticated user ID
   - confirm spoofed `x-user-id` headers are ignored if included
6. Validate ticker search/autocomplete in the holding form:
   - type a common symbol or company name such as `AAPL` or `Apple`
   - confirm matching symbols appear in a dropdown
   - select one result and confirm it prefills ticker/name/currency where available
   - confirm manual ticker entry still works if search is skipped or returns no result
   - confirm no price or market value preview is shown in Phase 3

Optional cleanup:

- Delete/archive test portfolios from the UI.
- If direct database cleanup is ever needed, confirm the test portfolio has no important report runs before manually deleting anything.

Manual work not required:

- no new Supabase Auth provider setup
- no new Google OAuth setup
- no new storage bucket setup
- no new queue schema setup
- no new production worker setup
- no Alpha Vantage production provider setup unless the user explicitly pulls provider migration into this phase

## 11) Implementation Stages

## Stage 0: Baseline And Phase 2 Carryover Check

Goal:

- Confirm Phase 3 starts from a clean, authenticated app baseline.

Tasks:

- Verify working tree is clean.
- Read Phase 2 execution notes.
- Confirm `/app` works when signed in.
- Confirm `/app` redirects to login when signed out.
- Confirm `src/proxy.ts` exists and `src/middleware.ts` is gone.
- Confirm report APIs use session auth, not `X-User-Id`.
- Confirm landing report-start CTAs still follow the Phase 2 rule:
  - signed out -> `/login?next=%2Fapp`
  - signed in -> `/app`
- Confirm whether the user wants to run the optional human landing CTA smoke checklist before moving deeper into portfolio UI.
- Confirm the owned-portfolio report API positive-path check is still deferred until Stage 9 of this phase.

Verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Stage 1: Portfolio Service And Contracts

Goal:

- Build the server-side portfolio domain boundary before UI.

Tasks:

- Add portfolio request/response schemas.
- Add service methods:
  - list portfolios for user
  - get portfolio detail for user
  - create portfolio
  - update portfolio
  - archive portfolio
  - add holding
  - update holding
  - remove holding
- Add repository interface and Prisma implementation.
- Enforce ownership in every method.
- Hide archived portfolios from normal list/detail flows.
- Return decimal fields as strings.
- Add portfolio readiness helper:
  - no holdings -> not ready
  - at least one valid holding -> ready for future report-generation phase

Recommended errors:

- `PortfolioNotFoundError`
- `PortfolioArchivedError`
- `HoldingNotFoundError`
- `DuplicateHoldingTickerError`
- `PortfolioValidationError` if useful beyond Zod

Tests:

- service success paths
- ownership isolation
- archived portfolio behavior
- duplicate ticker behavior
- decimal formatting
- readiness helper behavior

## Stage 2: Portfolio API Routes

Goal:

- Expose portfolio management through authenticated API routes.

Tasks:

- Add portfolio route handlers under `/api/v1/portfolios`.
- Use `getAuthenticatedApiUserId()`.
- Return `401 UNAUTHORIZED` for unauthenticated requests.
- Return `404` for not found or not owned.
- Return `409` for duplicate ticker if using conflict semantics.
- Return `400` for validation errors.
- Use the same error envelope pattern as report APIs:
  - `{ error: { code, message } }`
- Ignore any spoofed `x-user-id` header.

Recommended endpoints:

- `GET /api/v1/portfolios`
- `POST /api/v1/portfolios`
- `GET /api/v1/portfolios/:portfolioId`
- `PATCH /api/v1/portfolios/:portfolioId`
- `DELETE /api/v1/portfolios/:portfolioId`
- `POST /api/v1/portfolios/:portfolioId/holdings`
- `PATCH /api/v1/portfolios/:portfolioId/holdings/:holdingId`
- `DELETE /api/v1/portfolios/:portfolioId/holdings/:holdingId`

Tests:

- unauthenticated requests return 401
- spoofed `x-user-id` ignored
- validation errors return 400
- ownership failures return 404
- duplicate ticker returns 409
- archive removes portfolio from list
- holdings cannot be added to archived/not-owned portfolios

## Stage 3: Portfolio List Page

Goal:

- Give authenticated users a real `Portfolios` destination.

Tasks:

- Add `/app/portfolios`.
- Enable the Portfolios navigation item in `AppShell`.
- Update `/app` dashboard CTA to link to `/app/portfolios/new` or `/app/portfolios`.
- Show empty state when no portfolios exist.
- Show portfolio cards/table when portfolios exist.
- Include:
  - name
  - base currency
  - holding count
  - readiness status
  - created/updated date
- Add `Create Portfolio` primary action.

Tests:

- unauthenticated route redirect remains handled by app layout/proxy
- empty state renders
- portfolio list renders
- archived portfolios are hidden

## Stage 4: Create And Edit Portfolio UI

Goal:

- Let users create and update portfolio metadata.

Tasks:

- Add `/app/portfolios/new`.
- Add `/app/portfolios/[portfolioId]/edit`.
- Build portfolio form component.
- Validate form input before submit.
- Submit through API route or server action.
- On success:
  - create redirects to portfolio detail page
  - edit redirects back to portfolio detail page
- Show user-friendly validation errors.

Recommended fields:

- Portfolio name
- Base currency
- Description

Tests:

- form renders with labels
- client/server validation errors appear
- successful create redirects
- successful edit redirects

## Stage 5: Security Search Provider, API, And Autocomplete Contract

Goal:

- Add provider-abstracted ticker search so holding entry can offer a dropdown of matching securities without exposing provider details or secrets to the browser.

Tasks:

- Add a normalized security-search contract for results.
- Add a server-side `SecuritySearchProvider` interface.
- Add a local/dev provider backed by the existing market-data adapter direction.
  - Preferred local path: extend the Python adapter with a `/market-data/search` endpoint backed by yfinance `Search` or `Lookup`.
  - Acceptable first implementation if adapter work is deferred: a server-side provider wrapper that can be swapped later, but it must not leak yfinance/Yahoo response shapes to the UI.
- Keep the provider boundary compatible with a future Alpha Vantage `SYMBOL_SEARCH` implementation.
- Add `GET /api/v1/securities/search?query=<text>` as an authenticated API route.
- Use `getAuthenticatedApiUserId()` so unauthenticated requests return `401 UNAUTHORIZED`.
- Validate and normalize the search query before calling the provider.
- Return a limited list of normalized matches.
- Map provider failures to generic API errors.
- Do not call quote endpoints or fetch market prices in this stage.
- Do not persist search results to the database in Phase 3.
- Add clear tests for query validation, auth behavior, provider normalization, and provider failure handling.

Recommended normalized result fields:

- `symbol`
- `name`
- `exchange`
- `region`
- `currency`
- `matchScore`
- `provider`

Provider-specific notes:

- yfinance can support local development through `Search` / `Lookup` over Yahoo Finance results.
- Alpha Vantage production support should use `SYMBOL_SEARCH`.
- The code should assume provider symbol formats can differ.
- Store the selected provider-accepted symbol exactly as the chosen result returns it after app normalization.
- If the user manually types a symbol instead of selecting a result, save the manually entered symbol after the normal holding validation rules pass.

Tests:

- unauthenticated search requests return `401`
- invalid or too-short query returns `400`
- successful search returns normalized results only
- provider errors do not leak raw provider payloads
- results are limited and sorted by provider ranking or match score where available
- unsupported currencies are omitted or marked unavailable

## Stage 6: Portfolio Detail And Holdings UI

Goal:

- Let users manage holdings inside a portfolio.

Tasks:

- Add `/app/portfolios/[portfolioId]`.
- Show portfolio summary.
- Show readiness/completeness status.
- Show holdings table.
- Add holding form with ticker search/autocomplete.
- Edit holding flow.
- Remove holding flow.
- Keep delete/remove confirmations simple but explicit.
- Preserve manual ticker entry if autocomplete is skipped, empty, or unavailable.
- Selecting a ticker search result should prefill:
  - Ticker
  - Name
  - Currency, when confidently `USD` or `CAD`
- Do not show quote, price, market value, or ticker validation claims.

Recommended holdings table columns:

- Ticker
- Name
- Shares / units
- Average cost
- Currency
- Cost basis
- Actions

Cost basis display:

- `quantity * averageCost`
- computed server-side or safely client-side from strings
- label as estimated cost basis, not market value

Tests:

- detail page renders portfolio data
- holding list renders
- add holding validation works
- ticker search selection prefills holding fields
- manual fallback works when no search result is selected
- edit holding validation works
- remove holding confirmation works
- duplicate ticker error is user-friendly

## Stage 7: Readiness And Next-Step Guidance

Goal:

- Make it clear when a portfolio is ready for the future report-generation phase.

Tasks:

- Add readiness badge:
  - `Needs holdings`
  - `Ready for report`
- If no holdings, explain the next action plainly.
- If ready, show a disabled or placeholder `Generate Report` action with copy:
  - `Report generation comes next`
- Do not wire the button to the report API in Phase 3 unless the user explicitly expands scope.

Why not wire report generation yet:

- report-generation UI needs status polling, failure states, PDF download, and user messaging
- mixing that into Phase 3 would make portfolio management harder to review

Tests:

- no holdings -> not ready
- one or more holdings -> ready
- placeholder generate-report action does not accidentally enqueue reports

## Stage 8: Dashboard Integration

Goal:

- Make `/app` reflect the new portfolio capability.

Tasks:

- Update dashboard status cards.
- Replace disabled `Create Portfolio` button with a real link.
- Show portfolio count.
- Show latest portfolio or empty state.
- Keep report generation card as backend-ready / coming next.

Tests:

- dashboard renders portfolio count
- dashboard create link works
- no-portfolio empty state is clear

## Stage 9: Deferred Phase 2 Positive-Path Report API Check

Goal:

- Close the Phase 2 deferred owned-portfolio API verification using a real portfolio created through Phase 3.

Manual or automated flow:

1. Sign in.
2. Create a portfolio through `/app/portfolios/new`.
3. Add at least one holding.
4. Call `POST /api/v1/report-runs` with that portfolio ID.
5. Include a spoofed `x-user-id` header only as a negative check.
6. Confirm the response is `201` with `runId` and `QUEUED`.
7. Confirm `report_runs.user_id` equals the authenticated user ID, not the spoofed header.

Important:

- This does not require building report-generation UI.
- This does not require running the worker unless the user wants a full report-generation test.
- If the worker is not running, the run can remain `QUEUED`; the API ownership/auth check is still valid.

## Stage 10: Verification And Quality Gate

Goal:

- Verify the full Phase 3 surface before signoff.

Automated verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual validation:

- sign in
- open `/app`
- create portfolio
- edit portfolio
- add holding
- use ticker autocomplete and manual ticker fallback
- edit holding
- reject duplicate holding
- remove holding
- archive portfolio
- confirm archived portfolio disappears from list
- confirm DB rows have correct `user_id`
- confirm signed-out users cannot access portfolio pages or APIs
- complete Stage 9 report API positive-path check

## Stage 11: Documentation Updates

Goal:

- Keep the head-office chat context current.

Documents to update:

- create `chatbotNotes/phase-3-portfolio-management-mvp-execution.md`
- update `chatbotNotes/backend-knowledge-base.md` only if durable Q&A decisions are made
- update `chatbotNotes/phase-2-auth-app-shell-execution.md` only if Phase 3 closes the deferred owned-portfolio positive-path report API check and the team wants that closure reflected in the Phase 2 execution history

Do not overload Phase 1 or Phase 2 docs with Phase 3 implementation details.

## 12) Acceptance Criteria

Phase 3 is complete when:

1. Authenticated user can list their portfolios.
2. Authenticated user can create a manual portfolio.
3. Authenticated user can edit portfolio metadata.
4. Authenticated user can archive a portfolio.
5. Authenticated user can view portfolio detail.
6. Authenticated user can add holdings.
7. Authenticated user can edit holdings.
8. Authenticated user can remove holdings.
9. Holding entry includes API-backed ticker search/autocomplete.
10. Manual ticker entry still works when autocomplete is skipped or unavailable.
11. Ticker search is provider-abstracted and does not expose provider secrets or raw provider payloads.
12. Duplicate ticker entries are handled safely and clearly.
13. Decimal values preserve precision through API/service/UI boundaries.
14. Users cannot view or mutate another user's portfolios or holdings.
15. Unauthenticated portfolio and security-search API requests return `401`.
16. Portfolio UI shows clear empty, ready, and not-ready states.
17. App shell `Portfolios` navigation is live.
18. Dashboard CTA routes to portfolio creation/list.
19. Deferred Phase 2 owned-portfolio report API positive-path check is completed.
20. Tests, typecheck, lint, and build pass.

## 13) Suggested Implementation Order For The Next Chat

1. Read this document.
2. Read `chatbotNotes/phase-2-auth-app-shell-execution.md`.
3. Inspect `src/db/prisma/schema.prisma`.
4. Inspect `src/app/app/layout.tsx` and `src/components/app/AppShell.tsx`.
5. Confirm Phase 2 landing CTA behavior remains intact.
6. Build portfolio service and tests first.
7. Build portfolio API routes and tests.
8. Build portfolio list UI.
9. Build create/edit portfolio UI.
10. Build security search provider/API and tests.
11. Build portfolio detail and holdings UI with ticker autocomplete plus manual fallback.
12. Add readiness states.
13. Integrate dashboard/app shell navigation.
14. Run automated verification.
15. Guide the user through manual validation.
16. Close deferred Phase 2 owned-portfolio report API positive-path check.
17. Update Phase 3 execution notes.

## 14) Risks And Watchpoints

### Decimal Precision

Risk:

- Converting quantity/cost values through JavaScript numbers can silently lose precision.

Mitigation:

- Treat form values as strings.
- Validate decimal strings.
- Convert to `Prisma.Decimal` only server-side.
- Return decimals as strings to the UI.

### Duplicate Tickers

Risk:

- Database unique constraint catches duplicate `(portfolio_id, ticker)`, but the user experience would be poor if this appears as a generic server error.

Mitigation:

- Check duplicates in service logic.
- Return a clear `DUPLICATE_HOLDING_TICKER` error.
- Show a user-friendly message.

### Ownership Boundaries

Risk:

- Portfolio and holding routes are a direct access-control surface.

Mitigation:

- Every service method must scope by `userId`.
- Route handlers must use authenticated session user ID.
- Tests must cover not-owned portfolio and not-owned holding paths.

### Archive vs Delete

Risk:

- Hard delete could remove portfolio data needed for report history/auditability.

Mitigation:

- Use `archivedAt` for portfolio removal.
- Keep hard delete out of Phase 3 UI.

### Scope Creep Into Report Generation

Risk:

- It is tempting to wire `Generate Report` once the portfolio is ready.

Mitigation:

- Keep actual report generation UI for the next phase.
- Phase 3 may run a manual/API positive-path report-run check, but not build the full report UX.

### Ticker Search vs Market Validation

Risk:

- Users may expect autocomplete to guarantee that a holding can be priced or included in a report.

Mitigation:

- Phase 3 search is an entry aid, not a market-data guarantee.
- Market validation happens during report generation via the existing market-data pipeline.
- Keep manual ticker entry available.
- Do not show prices, quote freshness, or market values in Phase 3.
- Preserve provider-specific symbol-format caveats in implementation notes and tests.

### Provider Symbol Format Drift

Risk:

- Yahoo/yfinance and Alpha Vantage may use different symbols for the same listed security.

Mitigation:

- Store the symbol selected or entered by the user in the current provider-accepted format.
- Keep symbol search behind a provider abstraction so production can swap to Alpha Vantage without rewriting the holdings UI.
- Before production provider migration, verify common US and Canadian examples such as `AAPL`, `SHOP`, `SHOP.TO`, and the Alpha Vantage Toronto format.
- Do not silently rewrite saved tickers without a deliberate migration or user-visible confirmation flow.

### Phase 2 Carryover

Risk:

- The owned-portfolio positive-path report API check is still deferred because Phase 2 did not yet have portfolio UI/test data.
- The optional final human landing CTA smoke checklist may or may not have been run by the user before Phase 3 starts.

Mitigation:

- Stage 0 must explicitly confirm the finalized Phase 2 state.
- Stage 9 closes the deferred owned-portfolio report API positive-path check.
- If the user wants the optional landing CTA browser smoke checklist repeated, run it before deeper Phase 3 implementation.

## 15) Next Phase Preview

Recommended Phase 4:

`Report Generation UI`

Likely Phase 4 scope:

- generate report button
- create report run from portfolio detail
- status polling
- queued/processing/completed/failed UI
- signed PDF download link
- report-run error display
- report history entry point
